'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  alert?: { text: string };
}

export default function SlackAlert({ alert }: Props) {
  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          key="slackalert"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-4 flex max-w-md items-start gap-3 rounded-2xl border border-[var(--accent-guardian)] bg-white p-4 shadow"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-guardian)] font-bold text-white">
            SG
          </div>
          <div>
            <p className="text-sm font-semibold">
              Stripe&nbsp;Guardian <span className="ml-2 text-xs font-normal text-gray-400">just now</span>
            </p>
            <p className="mt-1 text-sm">{alert.text}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 