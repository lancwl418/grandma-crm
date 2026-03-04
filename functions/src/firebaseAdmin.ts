import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp();
}

export const db = getFirestore();

function resolveCollectionPath(template: string, userId: string): string {
  return template.replace("{userId}", userId);
}

export function getClientsCollectionPath(userId: string): string {
  const template = process.env.CRM_CLIENTS_COLLECTION || "clients";
  return resolveCollectionPath(template, userId);
}
