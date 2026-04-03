export interface Client {
  id: string;
  remarkName: string;
  name?: string | null;
  phone?: string;
  wechat?: string;
  birthday?: string;
  status: string;
  urgency: "high" | "medium" | "low";
  tags: string[];
  requirements: {
    budgetMin?: string;
    budgetMax?: string;
    notes?: string;
    areas?: string[];
    tags?: string[];
  };
  logs: ClientLog[];
  created_at?: string;
}

export interface ClientLog {
  id: string;
  date: string;
  content: string;
  images?: string[];
  nextAction?: string;
  nextActionTodo?: string;
}

export interface AgentProfile {
  username: string;
  display_name: string;
  title: string;
  phone: string;
  wechat: string;
  email: string;
  avatar_url: string;
}

export interface Stats {
  totalClients: number;
  newThisMonth: number;
  activeViewers: number;
  inquiries: number;
}
