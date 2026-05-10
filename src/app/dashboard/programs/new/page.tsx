import { redirect } from "next/navigation";

export default function NewProgramRedirect() {
  redirect("/dashboard/programs");
}
