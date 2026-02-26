import type { Client } from "@/crm/types";

// ── 日期解析 ──

const DAY_OFFSETS: Record<string, number> = {
  今天: 0, 今日: 0,
  明天: 1, 明日: 1,
  后天: 2, 後天: 2,
  大后天: 3, 大後天: 3,
};

const WEEKDAY_MAP: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0,
};

/**
 * 从文本中解析相对日期，返回 { date, matched } 或 null
 */
export function parseRelativeDate(text: string): { date: Date; matched: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 今天/明天/后天/大后天
  for (const [keyword, offset] of Object.entries(DAY_OFFSETS)) {
    if (text.includes(keyword)) {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      return { date: d, matched: keyword };
    }
  }

  // X天后 / X天之后
  const daysLater = text.match(/(\d+)\s*天[后之]/);
  if (daysLater) {
    const d = new Date(today);
    d.setDate(d.getDate() + parseInt(daysLater[1]));
    return { date: d, matched: daysLater[0] };
  }

  // 下周X / 下星期X / 下礼拜X
  const nextWeek = text.match(/下(?:周|星期|礼拜)([一二三四五六日天])?/);
  if (nextWeek) {
    const targetDay = nextWeek[1] ? WEEKDAY_MAP[nextWeek[1]] : 1; // 默认周一
    const currentDay = today.getDay();
    let daysUntil = targetDay - currentDay + 7;
    if (daysUntil <= 7) daysUntil += 7; // 确保是"下周"
    // 如果没指定具体星期几 (下周 without specifier)，取下周一
    if (!nextWeek[1]) {
      daysUntil = (1 - currentDay + 7) % 7;
      if (daysUntil <= 0) daysUntil += 7;
      // 确保是下周
      if (daysUntil <= (7 - currentDay)) daysUntil += 7;
    }
    const d = new Date(today);
    d.setDate(d.getDate() + daysUntil);
    return { date: d, matched: nextWeek[0] };
  }

  // 这周X / 本周X / 这个星期X
  const thisWeek = text.match(/(?:这|本)(?:周|星期|礼拜)([一二三四五六日天])/);
  if (thisWeek) {
    const targetDay = WEEKDAY_MAP[thisWeek[1]];
    const currentDay = today.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0) daysUntil += 7;
    const d = new Date(today);
    d.setDate(d.getDate() + daysUntil);
    return { date: d, matched: thisWeek[0] };
  }

  // X号 / X日（本月或下月）
  const dayOfMonth = text.match(/(\d{1,2})[号日]/);
  if (dayOfMonth) {
    const day = parseInt(dayOfMonth[1]);
    if (day >= 1 && day <= 31) {
      const d = new Date(today);
      d.setDate(day);
      // 如果已过去，跳到下个月
      if (d.getTime() < today.getTime()) {
        d.setMonth(d.getMonth() + 1);
      }
      return { date: d, matched: dayOfMonth[0] };
    }
  }

  return null;
}

// ── 客户匹配 ──

export type ClientMatch = {
  client: Client;
  score: number; // 1=完全匹配, 0.8=包含匹配, 0.5=姓氏匹配
  matchedText: string;
};

/**
 * 从文本中模糊匹配客户
 */
export function matchClient(text: string, clients: Client[]): ClientMatch[] {
  const matches: ClientMatch[] = [];

  for (const client of clients) {
    const names = [client.remarkName, client.name].filter(Boolean) as string[];

    for (const name of names) {
      // 完全匹配
      if (text.includes(name)) {
        matches.push({ client, score: 1, matchedText: name });
        break;
      }

      // 包含匹配 (客户名在语音文本中)
      if (name.length >= 2 && text.includes(name.slice(0, 2))) {
        matches.push({ client, score: 0.8, matchedText: name.slice(0, 2) });
        break;
      }
    }

    // 姓氏匹配（中文姓氏：取第一个字）
    if (!matches.find((m) => m.client.id === client.id)) {
      const chineseName = client.name || client.remarkName;
      if (chineseName && /[\u4e00-\u9fff]/.test(chineseName[0])) {
        const surname = chineseName[0];
        // 匹配 "X先生/女士/太太/哥/姐/总" 或直接姓名
        const surnamePattern = new RegExp(`${surname}(?:先生|女士|太太|小姐|老师|总|哥|姐|叔|阿姨)`);
        const surnameMatch = text.match(surnamePattern);
        if (surnameMatch) {
          matches.push({ client, score: 0.5, matchedText: surnameMatch[0] });
        }
      }
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

// ── 任务内容提取 ──

const FILLER_WORDS = /^[给跟和与向去找帮替让叫请对]/;

/**
 * 从文本中去掉日期和客户名后，提取任务内容
 */
export function extractAction(text: string, dateMatched?: string, clientMatched?: string): string {
  let action = text;

  // 去掉日期关键词
  if (dateMatched) {
    action = action.replace(dateMatched, "");
  }

  // 去掉客户名
  if (clientMatched) {
    action = action.replace(clientMatched, "");
  }

  // 去掉前导连接词
  action = action.replace(FILLER_WORDS, "").trim();

  // 如果还有前导连接词（嵌套情况），再去一次
  action = action.replace(FILLER_WORDS, "").trim();

  return action || text.trim();
}

// ── 组合解析 ──

export type VoiceTaskResult = {
  raw: string;
  date: Date | null;
  dateText: string | null;
  clientMatches: ClientMatch[];
  action: string;
};

/**
 * 解析语音文本，提取日期、客户、任务内容
 */
export function parseVoiceTask(text: string, clients: Client[]): VoiceTaskResult {
  const dateResult = parseRelativeDate(text);
  const clientMatches = matchClient(text, clients);
  const topClient = clientMatches[0];

  const action = extractAction(
    text,
    dateResult?.matched,
    topClient?.matchedText
  );

  return {
    raw: text,
    date: dateResult?.date ?? null,
    dateText: dateResult?.matched ?? null,
    clientMatches,
    action,
  };
}
