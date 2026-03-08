import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import PostHogProvider from "@/components/PostHogProvider";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PostHogProvider>
      <Header />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </PostHogProvider>
  );
}
