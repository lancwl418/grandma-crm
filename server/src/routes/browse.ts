import { Router } from "express";
import { searchListings, getPropertyDetail, getPropertyImage } from "../lib/zillow.js";
import { supabaseAdmin } from "../lib/supabase.js";

export const browseRouter = Router();

// ── Search listings (public, for client browse page) ────────

browseRouter.get("/search", async (req, res) => {
  try {
    const {
      location,
      listingType,
      minPrice,
      maxPrice,
      bedsMin,
      bathsMin,
      homeType,
      page,
    } = req.query;

    if (!location || typeof location !== "string") {
      res.status(400).json({ error: "location is required" });
      return;
    }

    const results = await searchListings({
      location,
      listingType: listingType === "rent" ? "rent" : "sale",
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      bedsMin: bedsMin ? Number(bedsMin) : undefined,
      bathsMin: bathsMin ? Number(bathsMin) : undefined,
      homeType: homeType as string | undefined,
      page: page ? Number(page) : 1,
    });

    res.json(results);
  } catch (err) {
    console.error("[browse/search]", err);
    res.status(502).json({ error: "Failed to search listings" });
  }
});

// ── Get listing detail (public) ─────────────────────────────

browseRouter.get("/listing/:zpid", async (req, res) => {
  try {
    const zpid = Number(req.params.zpid);
    if (!zpid) {
      res.status(400).json({ error: "Invalid zpid" });
      return;
    }
    const detail = await getPropertyDetail(zpid);
    res.json(detail);
  } catch (err) {
    console.error("[browse/listing]", err);
    res.status(502).json({ error: "Failed to get listing detail" });
  }
});

// ── Track browsing activity ─────────────────────────────────

browseRouter.post("/track", async (req, res) => {
  const { clientId, zpid, address, price, action, imageUrl } = req.body;

  if (!clientId || !zpid) {
    res.status(400).json({ error: "clientId and zpid are required" });
    return;
  }

  if (!supabaseAdmin) {
    res.status(500).json({ error: "Database not configured" });
    return;
  }

  const { error } = await supabaseAdmin.from("client_listing_views").insert({
    client_id: clientId,
    zpid: String(zpid),
    address: address || "",
    price: price || 0,
    image_url: imageUrl || null,
    action: action || "view",
  });

  if (error) {
    console.error("[browse/track]", error.message);
    res.status(500).json({ error: "Failed to track activity" });
    return;
  }

  res.json({ ok: true });
});

// ── Verify client by phone ──────────────────────────────────

browseRouter.post("/verify-phone", async (req, res) => {
  const { clientId, phone } = req.body;

  if (!clientId || !phone) {
    res.status(400).json({ error: "clientId and phone are required" });
    return;
  }

  if (!supabaseAdmin) {
    res.status(500).json({ error: "Database not configured" });
    return;
  }

  // Check if client exists and phone matches
  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("id, remark_name, name, phone")
    .eq("id", clientId)
    .single();

  if (error || !data) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  // Simple phone matching (strip non-digits)
  const normalize = (p: string) => p.replace(/\D/g, "").slice(-10);
  const storedPhone = normalize(data.phone || "");
  const inputPhone = normalize(phone);

  if (!storedPhone || storedPhone !== inputPhone) {
    res.status(403).json({ error: "Phone number does not match" });
    return;
  }

  res.json({
    ok: true,
    verified: true,
    clientName: data.remark_name || data.name || "",
  });
});

// ── Get agent info for a client ──────────────────────────────

browseRouter.get("/agent/:clientId", async (req, res) => {
  const { clientId } = req.params;

  if (!supabaseAdmin) {
    res.status(500).json({ error: "Database not configured" });
    return;
  }

  // Get client's user_id
  const { data: client, error } = await supabaseAdmin
    .from("clients")
    .select("user_id")
    .eq("id", clientId)
    .single();

  if (error || !client) {
    res.json({ agentName: "Your Agent", agentPhone: "", agentWechat: "", agentEmail: "", agentAvatar: "" });
    return;
  }

  // Try agent_profiles first
  const { data: profile } = await supabaseAdmin
    .from("agent_profiles")
    .select("display_name, phone, wechat, email, avatar_url, title")
    .eq("user_id", client.user_id)
    .single();

  if (profile?.display_name) {
    res.json({
      agentName: profile.display_name,
      agentTitle: profile.title || "房地产经纪人",
      agentPhone: profile.phone || "",
      agentWechat: profile.wechat || "",
      agentEmail: profile.email || "",
      agentAvatar: profile.avatar_url || "",
    });
    return;
  }

  // Fallback to auth user
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(client.user_id);
  const emailAddr = userData?.user?.email ?? "";
  const name = userData?.user?.user_metadata?.full_name
    ?? userData?.user?.user_metadata?.name
    ?? emailAddr.split("@")[0]
    ?? "Your Agent";

  res.json({ agentName: name, agentPhone: "", agentWechat: "", agentEmail: emailAddr, agentAvatar: "" });
});

// ── Register new client from browse page ────────────────────

browseRouter.post("/register", async (req, res) => {
  const { agentId, name, phone, email, wechat } = req.body;

  if (!agentId) {
    res.status(400).json({ error: "agentId is required" });
    return;
  }

  if (!name && !phone && !email) {
    res.status(400).json({ error: "At least name, phone, or email is required" });
    return;
  }

  if (!supabaseAdmin) {
    res.status(500).json({ error: "Database not configured" });
    return;
  }

  // Create new client under this agent
  const { data, error } = await supabaseAdmin
    .from("clients")
    .insert({
      user_id: agentId,
      remark_name: name || phone || email || "新访客",
      name: name || null,
      phone: phone || null,
      wechat: wechat || null,
      status: "新客户",
      urgency: "medium",
      tags: ["网页访客"],
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[browse/register]", error?.message);
    res.status(500).json({ error: "Failed to create client" });
    return;
  }

  res.json({ ok: true, clientId: data.id });
});

// ── Get client browse history (for CRM side) ────────────────

browseRouter.get("/history/:clientId", async (req, res) => {
  const { clientId } = req.params;

  if (!supabaseAdmin) {
    res.status(500).json({ error: "Database not configured" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("client_listing_views")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[browse/history]", error.message);
    res.status(500).json({ error: "Failed to get history" });
    return;
  }

  const views = data ?? [];

  // Backfill missing images (fire-and-forget, don't block response)
  const missingImageViews = views.filter((v: any) => !v.image_url && v.zpid);
  if (missingImageViews.length > 0) {
    // Deduplicate by zpid
    const uniqueZpids = [...new Set(missingImageViews.map((v: any) => v.zpid))];
    // Backfill up to 3 at a time to avoid too many API calls
    Promise.all(
      uniqueZpids.slice(0, 3).map(async (zpid) => {
        try {
          const imageUrl = await getPropertyImage(Number(zpid));
          if (imageUrl && supabaseAdmin) {
            await supabaseAdmin
              .from("client_listing_views")
              .update({ image_url: imageUrl })
              .eq("zpid", zpid)
              .is("image_url", null);
          }
        } catch { /* ignore */ }
      })
    ).catch(() => {});
  }

  res.json({ views });
});
