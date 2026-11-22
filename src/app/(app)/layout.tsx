import { StudyProvider } from "@/client/store";
import { AppFrame } from "@/components/AppFrame";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <StudyProvider>
      <AppFrame>{children}</AppFrame>
    </StudyProvider>
  );
}
