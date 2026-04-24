import { demoIssue } from "@branch/shared";
import { Dashboard } from "@/components/dashboard";

export default function Home() {
  return <Dashboard initialIssue={demoIssue} />;
}
