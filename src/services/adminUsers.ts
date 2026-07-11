import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../config/firebase";
import type { AppUser } from "../types/domain";
import { listUsers } from "./firestore";

export async function listAdministrativeUsers() {
  if (!isFirebaseConfigured) return listUsers();
  const snapshot = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(500)));
  return snapshot.docs.map((item) => ({ ...item.data(), uid: item.id }) as AppUser);
}
