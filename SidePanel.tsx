import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Dismiss24Regular } from '@fluentui/react-icons';

type SidePanelProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export const SidePanel = ({ isOpen, onClose, title, children, footer }: SidePanelProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="side-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.aside
            className="side-sheet erp-scroll"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="sheet-header">
              <div>
                <strong>{title}</strong>
                <p>Panel contextual enterprise</p>
              </div>
              <button type="button" className="icon-btn" onClick={onClose}>
                <Dismiss24Regular />
              </button>
            </header>

            <section className="sheet-body">{children}</section>

            {footer && <footer className="sheet-footer">{footer}</footer>}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
