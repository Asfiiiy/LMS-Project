'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import OnboardingGuard from '@/app/components/OnboardingGuard';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 }
};

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <OnboardingGuard>
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </OnboardingGuard>
  );
}
