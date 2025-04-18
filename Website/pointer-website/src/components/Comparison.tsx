'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

export default function Comparison() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const features = [
    {
      feature: "Open Source",
      pointer: "✓ Fully open-source",
      others: "✗ Proprietary",
    },
    {
      feature: "Local Processing",
      pointer: "✓ Runs entirely on your machine",
      others: "✗ Cloud-based",
    },
    {
      feature: "Privacy",
      pointer: "✓ Code never leaves your device",
      others: "✗ Code sent to external servers",
    },
    {
      feature: "Internet Required",
      pointer: "✓ Works completely offline",
      others: "✗ Requires constant connection",
    },
    {
      feature: "Usage Limits",
      pointer: "✓ No throttling or limits",
      others: "✗ Usage quotas and limits",
    },
    {
      feature: "Customization",
      pointer: "✓ Fully customizable",
      others: "✗ Limited customization",
    },
  ];

  return (
    <section 
      id="comparison"
      ref={ref}
      className="relative py-24 overflow-hidden bg-gradient-to-b from-primary/5 to-transparent"
    >
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            How Pointer{" "}
            <span className="text-primary">Stands Out</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            See how Pointer compares to traditional AI coding assistants
          </p>
        </motion.div>

        <div className="w-full">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-4 px-6 text-left text-gray-300 font-semibold">Feature</th>
                <th className="py-4 px-6 text-left text-primary font-semibold">Pointer</th>
                <th className="py-4 px-6 text-left text-gray-400 font-semibold">Other AI Assistants</th>
              </tr>
            </thead>
            <tbody>
              {features.map((item, index) => (
                <motion.tr
                  key={item.feature}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.1 }}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="py-4 px-6 text-gray-300">{item.feature}</td>
                  <td className="py-4 px-6 text-primary">{item.pointer}</td>
                  <td className="py-4 px-6 text-gray-400">{item.others}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
} 