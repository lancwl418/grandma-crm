import { createContext, useContext } from "react";

export const UserContext = createContext<string | undefined>(undefined);

export function useUserId(): string | undefined {
  return useContext(UserContext);
}
