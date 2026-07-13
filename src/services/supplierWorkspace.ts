import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../config/firebase";
import { demoGetSupplier, demoUpdateApprovedSupplier } from "./localDemo";

export async function updateOwnSupplierCategories(supplierId: string, ownerUserId: string, categories: string[], subcategories: string[]) {
  if (!isFirebaseConfigured) {
    const supplier = await demoGetSupplier(supplierId);
    if (!supplier || supplier.createdBy !== ownerUserId) throw new Error("supplier_profile_not_owned");
    await demoUpdateApprovedSupplier(supplierId, ownerUserId, { ...supplier, categories, subcategories, searchKeywords: [...new Set([...supplier.searchKeywords, ...categories, ...subcategories])] });
    return;
  }
  await updateDoc(doc(db, "suppliers", supplierId), { categories, subcategories, updatedAt: serverTimestamp() });
}
