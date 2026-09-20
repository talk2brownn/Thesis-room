import { motion } from "framer-motion";

const VERDICT_META = {
  constructive: { label: "Constructive", tone: "up" },
  cautious: { label: "Cautious", tone: "mid" },
  mixed: { label: "Mixed", tone: "mid" },
  avoid: { label: "Avoid", tone: "down" },
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

export default function ThesisCard({ result }) {
  const { symbol, question, thesis } = result;
  const meta = VERDICT_META[thesis.verdict] || VERDICT_META.mixed;

  return (
    <motion.article
      className="thesis-card"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.header className="thesis-header" variants={item}>
        <div>
          <div className="thesis-symbol">{symbol}</div>
          {question && <div className="thesis-question">&ldquo;{question}&rdquo;</div>}
        </div>
        <motion.span
          className={`verdict verdict-${meta.tone}`}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.15 }}
        >
          {meta.label}
        </motion.span>
      </motion.header>

      <div className="thesis-body">
        <motion.section className="case bull" variants={item}>
          <h3>Bull case</h3>
          <p>{thesis.bull_case || "Not enough live data to make this case."}</p>
        </motion.section>
        <div className="case-divider" />
        <motion.section className="case bear" variants={item}>
          <h3>Bear case</h3>
          <p>{thesis.bear_case || "Not enough live data to make this case."}</p>
        </motion.section>
      </div>

      <motion.div className="thesis-risk" variants={item}>
        <span className="risk-label">Key risk</span>
        <p>{thesis.key_risk}</p>
      </motion.div>

      {thesis.data_gaps && (
        <motion.div className="thesis-gaps" variants={item}>
          <span className="gaps-label">Data gaps</span> {thesis.data_gaps}
        </motion.div>
      )}

      <motion.footer className="thesis-footer" variants={item}>
        synthesized by {thesis.provider} · not financial advice
      </motion.footer>
    </motion.article>
  );
}
