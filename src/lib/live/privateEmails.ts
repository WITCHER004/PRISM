import { create } from "zustand"

// Members' email addresses, uid → email. Filled only for staff, from user_private/{uid}
// (the Firestore rules let nobody else read it). Never persisted.
export const usePrivateEmails = create<{ byUid: Record<string, string>; set: (byUid: Record<string, string>) => void }>((set) => ({
  byUid: {},
  set: (byUid) => set({ byUid }),
}))
