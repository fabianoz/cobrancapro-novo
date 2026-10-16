import Sidebar from '@/components/sidebar';
import { Footer } from '@/components/footer';
import { AuthGuard } from '@/components/auth-guard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <AuthGuard>
        <Sidebar />
        <main className="flex-1 lg:ml-0 pt-14 lg:pt-0 min-w-0 flex flex-col">
          <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            {children}
          </div>
          <Footer />
        </main>
      </AuthGuard>
    </div>
  );
}
