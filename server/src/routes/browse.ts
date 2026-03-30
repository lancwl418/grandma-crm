import { Router } from "express";
import { searchListings, getPropertyDetail, getPropertyImage } from "../lib/zillow.js";
import { supabaseAdmin } from "../lib/supabase.js";

export const browseRouter = Router();

// ── Search listings (public, for client browse page) ────────

// ── Autocomplete ────────────────────────────────────────────

browseRouter.get("/autocomplete", async (req, res) => {
  const { query } = req.query;
  if (!query || typeof query !== "string" || query.length < 2) {
    res.json({ results: [] });
    return;
  }

  try {
    const response = await fetch(
      `https://private-zillow.p.rapidapi.com/autocomplete?query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Content-Type": "application/json",
          "x-rapidapi-host": "private-zillow.p.rapidapi.com",
          "x-rapidapi-key": process.env.RAPIDAPI_KEY || "",
        },
      }
    );
    const data = await response.json();
    const results = (data.results ?? []).slice(0, 6).map((r: any) => ({
      display: r.display,
      type: r.metaData?.regionType || r.resultType || "",
    }));
    res.json({ results });
  } catch {
    res.json({ results: [] });
  }
});

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

// ── WeChat login (code2session) ──────────────────────────────

browseRouter.post("/wx-login", async (req, res) => {
  const { code } = req.body;
  if (!code) {
    res.status(400).json({ error: "code is required" });
    return;
  }

  const appId = process.env.WX_APPID;
  const secret = process.env.WX_SECRET;
  if (!appId || !secret) {
    res.status(500).json({ error: "WeChat config not set" });
    return;
  }

  try {
    const wxRes = await fetch(
      `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${secret}&js_code=${code}&grant_type=authorization_code`
    );
    const wxData = await wxRes.json() as { openid?: string; session_key?: string; errcode?: number };

    if (!wxData.openid) {
      res.status(400).json({ error: "WeChat login failed", detail: wxData });
      return;
    }

    // Find existing client by openid (stored in wechat field)
    let clientId: string | null = null;
    let agentUserId: string | null = null;
    let agentDisplayName: string | null = null;

    if (supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from("clients")
        .select("id")
        .eq("wechat", `wx:${wxData.openid}`)
        .limit(1)
        .single();
      clientId = data?.id ?? null;

      // Also check if this openid is bound to an agent
      const { data: agentProfile } = await supabaseAdmin
        .from("agent_profiles")
        .select("user_id, display_name")
        .eq("wx_openid", wxData.openid)
        .limit(1)
        .single();

      if (agentProfile) {
        agentUserId = agentProfile.user_id;
        agentDisplayName = agentProfile.display_name || null;
      }
    }

    res.json({
      openid: wxData.openid,
      clientId,
      agentUserId,
      agentDisplayName,
    });
  } catch (err) {
    console.error("[wx-login]", err);
    res.status(502).json({ error: "WeChat API error" });
  }
});

// ── Client login by phone ────────────────────────────────────

browseRouter.post("/client-login", async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    res.json({ clientId: null });
    return;
  }
  if (!supabaseAdmin) {
    res.json({ clientId: null });
    return;
  }

  const normalize = (p: string) => p.replace(/\D/g, "").slice(-10);
  const inputPhone = normalize(phone);

  // Search all clients by phone
  const { data } = await supabaseAdmin
    .from("clients")
    .select("id, phone")
    .not("phone", "is", null);

  if (!data) {
    res.json({ clientId: null });
    return;
  }

  // Find matching phone
  const match = data.find((c: any) => c.phone && normalize(c.phone) === inputPhone);
  res.json({ clientId: match?.id ?? null });
});

// ── Get client name ──────────────────────────────────────────

browseRouter.get("/client-name/:clientId", async (req, res) => {
  const { clientId } = req.params;
  if (!supabaseAdmin) { res.json({ name: "" }); return; }

  const { data } = await supabaseAdmin
    .from("clients")
    .select("remark_name, name")
    .eq("id", clientId)
    .single();

  res.json({ name: data?.remark_name || data?.name || "" });
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

// ── Lookup username → email (for login) ─────────────────────

browseRouter.get("/lookup-username", async (req, res) => {
  const { username } = req.query;

  if (!username || typeof username !== "string") {
    res.json({ email: null });
    return;
  }

  if (!supabaseAdmin) {
    res.json({ email: null });
    return;
  }

  // Search agent_profiles by username first, then display_name
  const { data } = await supabaseAdmin
    .from("agent_profiles")
    .select("user_id")
    .or(`username.ilike.${username.trim()},display_name.ilike.${username.trim()}`)
    .limit(1)
    .single();

  if (!data) {
    res.json({ email: null });
    return;
  }

  // Get email from auth
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
  res.json({ email: userData?.user?.email ?? null });
});

// ── Get agent profile by userId (for register page) ─────────

browseRouter.get("/agent-profile/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!supabaseAdmin) {
    res.json({ agentName: "Agent", agentTitle: "", agentAvatar: "" });
    return;
  }

  const { data: profile } = await supabaseAdmin
    .from("agent_profiles")
    .select("display_name, title, avatar_url, phone")
    .eq("user_id", userId)
    .single();

  if (profile?.display_name) {
    res.json({
      agentName: profile.display_name,
      agentTitle: profile.title || "",
      agentAvatar: profile.avatar_url || "",
      agentPhone: profile.phone || "",
    });
    return;
  }

  // Fallback
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  res.json({
    agentName: userData?.user?.user_metadata?.full_name ?? userData?.user?.email?.split("@")[0] ?? "Agent",
    agentTitle: "",
    agentAvatar: "",
    agentPhone: "",
  });
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

// ── Client message / inquiry ─────────────────────────────────

browseRouter.post("/message", async (req, res) => {
  const { clientId, message, listingAddress, listingPrice } = req.body;

  if (!clientId || !message) {
    res.status(400).json({ error: "clientId and message are required" });
    return;
  }

  if (!supabaseAdmin) {
    res.status(500).json({ error: "Database not configured" });
    return;
  }

  // Save as client log
  const content = listingAddress
    ? `[客户留言] 关于 ${listingAddress}${listingPrice ? ` ($${listingPrice.toLocaleString()})` : ""}:\n${message}`
    : `[客户留言] ${message}`;

  const { error } = await supabaseAdmin
    .from("client_logs")
    .insert({
      client_id: clientId,
      date: new Date().toISOString(),
      content,
    });

  if (error) {
    console.error("[browse/message]", error.message);
    res.status(500).json({ error: "Failed to save message" });
    return;
  }

  res.json({ ok: true });
});

// ── Agent login (email + password via Supabase Auth) ─────────

browseRouter.post("/agent-login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  if (!supabaseAdmin) {
    res.status(500).json({ error: "Database not configured" });
    return;
  }

  try {
    // If input doesn't look like an email, try to look up by username
    let loginEmail = email;
    if (!email.includes("@")) {
      const { data: profile } = await supabaseAdmin
        .from("agent_profiles")
        .select("user_id")
        .or(`username.ilike.${email.trim()},display_name.ilike.${email.trim()}`)
        .limit(1)
        .single();

      if (profile) {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
        loginEmail = userData?.user?.email ?? email;
      }
    }

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: loginEmail,
      password
    });

    if (error || !data.user) {
      res.status(401).json({ error: "账号或密码错误" });
      return;
    }

    // Get display name from profile
    let displayName = data.user.user_metadata?.full_name || data.user.email?.split("@")[0] || "Agent";
    const { data: profile } = await supabaseAdmin
      .from("agent_profiles")
      .select("display_name")
      .eq("user_id", data.user.id)
      .single();

    if (profile?.display_name) {
      displayName = profile.display_name;
    }

    res.json({
      userId: data.user.id,
      email: data.user.email || loginEmail,
      displayName
    });
  } catch (err) {
    console.error("[agent-login]", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ── Agent stats ──────────────────────────────────────────────

browseRouter.get("/agent-stats/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!supabaseAdmin) {
    res.json({ totalClients: 0, visitors: 0, interested: 0 });
    return;
  }

  try {
    // Total clients
    const { count: totalClients } = await supabaseAdmin
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    // Visitors (clients with tag '网页访客' or '小程序访客')
    const { count: visitors } = await supabaseAdmin
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .overlaps("tags", ["网页访客", "小程序访客"]);

    // Interested (status = '意向强烈' or '看房中')
    const { count: interested } = await supabaseAdmin
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["意向强烈", "看房中"]);

    res.json({
      totalClients: totalClients || 0,
      visitors: visitors || 0,
      interested: interested || 0
    });
  } catch (err) {
    console.error("[agent-stats]", err);
    res.json({ totalClients: 0, visitors: 0, interested: 0 });
  }
});

// ── Agent visitors (clients with browse activity) ────────────

browseRouter.get("/agent-visitors/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!supabaseAdmin) {
    res.json({ visitors: [] });
    return;
  }

  try {
    // Get all clients for this agent
    const { data: clients } = await supabaseAdmin
      .from("clients")
      .select("id, remark_name, name")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (!clients || clients.length === 0) {
      res.json({ visitors: [] });
      return;
    }

    const clientIds = clients.map((c: any) => c.id);

    // Get browse activity grouped by client
    const { data: views } = await supabaseAdmin
      .from("client_listing_views")
      .select("client_id, created_at")
      .in("client_id", clientIds)
      .order("created_at", { ascending: false });

    // Aggregate per client
    const viewMap: Record<string, { count: number; lastActive: string }> = {};
    for (const v of views || []) {
      if (!viewMap[v.client_id]) {
        viewMap[v.client_id] = { count: 0, lastActive: v.created_at };
      }
      viewMap[v.client_id].count++;
    }

    // Only return clients that have views
    const visitors = clients
      .filter((c: any) => viewMap[c.id])
      .map((c: any) => ({
        clientId: c.id,
        clientName: c.remark_name || c.name || "未知访客",
        lastActive: viewMap[c.id].lastActive,
        viewCount: viewMap[c.id].count
      }));

    res.json({ visitors });
  } catch (err) {
    console.error("[agent-visitors]", err);
    res.json({ visitors: [] });
  }
});

// ── Agent clients list ───────────────────────────────────────

browseRouter.get("/agent-clients/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!supabaseAdmin) {
    res.json({ clients: [] });
    return;
  }

  try {
    const { data: clients } = await supabaseAdmin
      .from("clients")
      .select("id, remark_name, name, phone, status, urgency")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(100);

    const result = (clients || []).map((c: any) => ({
      id: c.id,
      name: c.remark_name || c.name || "未命名客户",
      phone: c.phone || "",
      status: c.status || "新客户",
      urgency: c.urgency || "medium"
    }));

    res.json({ clients: result });
  } catch (err) {
    console.error("[agent-clients]", err);
    res.json({ clients: [] });
  }
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

// ── Agent bind (link WeChat to existing agent account) ──────

browseRouter.post("/agent-bind", async (req, res) => {
  const { username, openid, nickName, avatarUrl } = req.body;

  if (!username || !openid) {
    res.status(400).json({ error: "username and openid are required" });
    return;
  }

  if (!supabaseAdmin) {
    res.status(500).json({ error: "Database not configured" });
    return;
  }

  try {
    // Find agent_profiles by username
    const { data: profile, error } = await supabaseAdmin
      .from("agent_profiles")
      .select("user_id, display_name")
      .ilike("username", username.trim())
      .limit(1)
      .single();

    if (error || !profile) {
      res.status(404).json({ error: "未找到该用户名对应的经纪人账号" });
      return;
    }

    // Update wx_openid on the profile
    const updates: Record<string, string> = { wx_openid: openid };
    if (avatarUrl) updates.avatar_url = avatarUrl;

    await supabaseAdmin
      .from("agent_profiles")
      .update(updates)
      .eq("user_id", profile.user_id);

    res.json({
      userId: profile.user_id,
      displayName: profile.display_name || nickName || username,
    });
  } catch (err) {
    console.error("[agent-bind]", err);
    res.status(500).json({ error: "关联失败" });
  }
});

// ── Agent register (new agent via WeChat) ────────────────────

browseRouter.post("/agent-register", async (req, res) => {
  const { username, displayName, avatarUrl, openid } = req.body;

  if (!username || !displayName || !openid) {
    res.status(400).json({ error: "username, displayName, and openid are required" });
    return;
  }

  if (!supabaseAdmin) {
    res.status(500).json({ error: "Database not configured" });
    return;
  }

  try {
    // Check username uniqueness
    const { data: existing } = await supabaseAdmin
      .from("agent_profiles")
      .select("user_id")
      .ilike("username", username.trim())
      .limit(1)
      .single();

    if (existing) {
      res.status(409).json({ error: "该用户名已被使用" });
      return;
    }

    // Create Supabase auth user with synthetic email
    const syntheticEmail = `${username.trim().toLowerCase()}@wx.estateepic.com`;
    const randomPassword = crypto.randomUUID();

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password: randomPassword,
      email_confirm: true,
      user_metadata: { full_name: displayName },
    });

    if (authError || !authData.user) {
      console.error("[agent-register] auth create error:", authError?.message);
      res.status(500).json({ error: "创建账号失败" });
      return;
    }

    const userId = authData.user.id;

    // Create agent_profiles entry
    const { error: profileError } = await supabaseAdmin
      .from("agent_profiles")
      .insert({
        user_id: userId,
        username: username.trim(),
        display_name: displayName,
        avatar_url: avatarUrl || null,
        wx_openid: openid,
      });

    if (profileError) {
      console.error("[agent-register] profile insert error:", profileError.message);
      // Try to clean up auth user
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      res.status(500).json({ error: "创建经纪人资料失败" });
      return;
    }

    res.json({ userId, displayName });
  } catch (err) {
    console.error("[agent-register]", err);
    res.status(500).json({ error: "注册失败" });
  }
});

// ── Client detail (for agent CRM) ──────────────────────────────

browseRouter.get("/client-detail/:clientId", async (req, res) => {
  const { clientId } = req.params;

  if (!supabaseAdmin) {
    res.status(500).json({ error: "Database not configured" });
    return;
  }

  try {
    // Get client info
    const { data: client, error } = await supabaseAdmin
      .from("clients")
      .select("id, remark_name, name, phone, wechat, status, urgency, tags, budget_min, budget_max, requirement_notes")
      .eq("id", clientId)
      .single();

    if (error || !client) {
      res.status(404).json({ error: "Client not found" });
      return;
    }

    // Get recent logs
    const { data: logs } = await supabaseAdmin
      .from("client_logs")
      .select("id, date, content, next_action")
      .eq("client_id", clientId)
      .order("date", { ascending: false })
      .limit(20);

    // Get browse history
    const { data: views } = await supabaseAdmin
      .from("client_listing_views")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(30);

    // Separate favorites
    const allViews = views || [];
    const favorites = allViews.filter((v: any) => v.action === "favorite");
    const browseHistory = allViews.filter((v: any) => v.action === "view");

    res.json({
      client: {
        id: client.id,
        name: client.remark_name || client.name || "未命名客户",
        phone: client.phone || "",
        wechat: client.wechat || "",
        status: client.status || "新客户",
        urgency: client.urgency || "medium",
        tags: client.tags || [],
        budget: [client.budget_min, client.budget_max].filter(Boolean).join(" - ") || "",
        needs: client.requirement_notes || "",
      },
      logs: (logs || []).map((l: any) => ({
        id: l.id,
        date: l.date,
        content: l.content,
        nextAction: l.next_action || "",
      })),
      browseHistory: browseHistory.map((v: any) => ({
        zpid: v.zpid,
        address: v.address,
        price: v.price,
        imageUrl: v.image_url,
        createdAt: v.created_at,
      })),
      favorites: favorites.map((v: any) => ({
        zpid: v.zpid,
        address: v.address,
        price: v.price,
        imageUrl: v.image_url,
        createdAt: v.created_at,
      })),
    });
  } catch (err) {
    console.error("[client-detail]", err);
    res.status(500).json({ error: "Failed to get client detail" });
  }
});

// ── Update agent profile ──────────────────────────────────────

browseRouter.post("/update-agent-profile", async (req, res) => {
  const { userId, displayName, phone, wechat, email, title } = req.body;

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  if (!supabaseAdmin) {
    res.status(500).json({ error: "Database not configured" });
    return;
  }

  try {
    const updates: Record<string, string | null> = {};
    if (displayName !== undefined) updates.display_name = displayName;
    if (phone !== undefined) updates.phone = phone;
    if (wechat !== undefined) updates.wechat = wechat;
    if (email !== undefined) updates.email = email;
    if (title !== undefined) updates.title = title;

    const { error } = await supabaseAdmin
      .from("agent_profiles")
      .update(updates)
      .eq("user_id", userId);

    if (error) {
      console.error("[update-agent-profile]", error.message);
      res.status(500).json({ error: "Failed to update profile" });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[update-agent-profile]", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ── Agent activity feed ─────────────────────────────────────────

browseRouter.get("/agent-activity/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!supabaseAdmin) {
    res.json({ activities: [] });
    return;
  }

  try {
    // Get all clients for this agent
    const { data: clients } = await supabaseAdmin
      .from("clients")
      .select("id, remark_name, name")
      .eq("user_id", userId);

    if (!clients || clients.length === 0) {
      res.json({ activities: [] });
      return;
    }

    const clientIds = clients.map((c: any) => c.id);
    const clientMap: Record<string, string> = {};
    for (const c of clients) {
      clientMap[c.id] = c.remark_name || c.name || "未知客户";
    }

    // Get recent browse activity
    const { data: views } = await supabaseAdmin
      .from("client_listing_views")
      .select("client_id, address, action, created_at")
      .in("client_id", clientIds)
      .order("created_at", { ascending: false })
      .limit(30);

    const activities = (views || []).map((v: any) => {
      const clientName = clientMap[v.client_id] || "未知客户";
      const actionText = v.action === "favorite" ? "收藏了" : v.action === "inquiry" ? "咨询了" : "浏览了";
      return {
        clientId: v.client_id,
        clientName,
        action: actionText,
        address: v.address || "某房源",
        createdAt: v.created_at,
      };
    });

    res.json({ activities });
  } catch (err) {
    console.error("[agent-activity]", err);
    res.json({ activities: [] });
  }
});

// ── Agent full profile (for editing) ─────────────────────────────

browseRouter.get("/agent-full-profile/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!supabaseAdmin) {
    res.json({});
    return;
  }

  try {
    const { data: profile } = await supabaseAdmin
      .from("agent_profiles")
      .select("display_name, username, phone, wechat, email, title, avatar_url")
      .eq("user_id", userId)
      .single();

    if (!profile) {
      res.json({
        displayName: "",
        username: "",
        phone: "",
        wechat: "",
        email: "",
        title: "",
        avatarUrl: "",
      });
      return;
    }

    res.json({
      displayName: profile.display_name || "",
      username: profile.username || "",
      phone: profile.phone || "",
      wechat: profile.wechat || "",
      email: profile.email || "",
      title: profile.title || "",
      avatarUrl: profile.avatar_url || "",
    });
  } catch (err) {
    console.error("[agent-full-profile]", err);
    res.json({});
  }
});
