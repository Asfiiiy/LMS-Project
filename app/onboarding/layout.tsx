import OnboardingGuard from '@/app/components/OnboardingGuard';

export default function OnboardingLayoutWrapper({ children }: { children: React.ReactNode }) {
  return <OnboardingGuard>{children}</OnboardingGuard>;
}
