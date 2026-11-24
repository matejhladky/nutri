import { redirect } from "next/navigation";
import { adminLearners } from "@/server/admin";

export default function AdminHome() {
  redirect(`/admin/${adminLearners()[0]?.id ?? "obsah"}`);
}
