export function getBirthdayStatus(birthdayString?: string) {
    if (!birthdayString) return null;
  
    const today = new Date();
    today.setHours(0, 0, 0, 0);
  
    const [year, month, day] = birthdayString.split("-").map(Number);
    const birthDate = new Date(today.getFullYear(), month - 1, day);
  
    if (birthDate < today) {
      birthDate.setFullYear(today.getFullYear() + 1);
    }
  
    const diffDays = Math.ceil((birthDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
    if (diffDays <= 30) {
      return {
        isComing: true,
        days: diffDays,
        display: `${month}月${day}日`
      };
    }
  
    return null;
  }
  