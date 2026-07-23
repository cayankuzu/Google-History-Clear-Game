import { AnimatePresence, motion } from "framer-motion";

type InnerMonologueProps = {
  messages: string[];
};

export function InnerMonologue({ messages }: InnerMonologueProps) {
  return (
    <aside className="inner-monologue" aria-label="İç konuşma" aria-live="polite">
      <div className="monologue-name">
        <span />
        İÇ SES
      </div>
      <div className="monologue-messages">
        <AnimatePresence initial={false}>
          {messages.slice(-3).map((message, index) => (
            <motion.p
              key={`${message}-${messages.length - index}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: index === messages.slice(-3).length - 1 ? 1 : 0.45, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
            >
              {message}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>
    </aside>
  );
}
