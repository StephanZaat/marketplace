import React, { useState } from "react";
import { Star, X } from "lucide-react";
import toast from "react-hot-toast";
import api, { PendingRating } from "../api";
import { useLang } from "../contexts/LanguageContext";

interface Props {
  pending: PendingRating;
  onDismiss: () => void;   // skip / close without rating
  onSubmitted: () => void; // rating saved
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star
            className={`w-7 h-7 transition-colors ${
              s <= (hover || value)
                ? "text-amber-400 fill-amber-400"
                : "text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function RatingModal({ pending, onDismiss, onSubmitted }: Props) {
  const { t } = useLang();
  const isBuyer = pending.role === "buyer_rating_seller";

  const [description, setDescription] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [exchange, setExchange] = useState(0);
  const [overall, setOverall] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = isBuyer
    ? description > 0 && communication > 0 && exchange > 0
    : overall > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post("/ratings", {
        listing_id: pending.listing_id,
        ratee_id: pending.other_user_id,
        role: pending.role,
        ...(isBuyer
          ? { score_description: description, score_communication: communication, score_exchange: exchange }
          : { score_overall: overall }),
      });
      toast.success(t.ratingSaved);
      onSubmitted();
    } catch {
      toast.error(t.ratingFailed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900 text-lg">{t.rateUser}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {pending.other_user_name ?? t.unknownUser} · {pending.listing_title}
            </p>
          </div>
          <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 ml-2 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isBuyer ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1.5">{t.ratingDescription}</p>
              <StarPicker value={description} onChange={setDescription} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1.5">{t.ratingCommunication}</p>
              <StarPicker value={communication} onChange={setCommunication} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1.5">{t.ratingExchange}</p>
              <StarPicker value={exchange} onChange={setExchange} />
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1.5">{t.ratingOverall}</p>
            <StarPicker value={overall} onChange={setOverall} />
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={onDismiss} className="flex-1 btn-secondary text-sm">
            {t.ratingSkip}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="flex-1 btn-primary text-sm disabled:opacity-50"
          >
            {submitting ? "…" : t.ratingSubmit}
          </button>
        </div>
      </div>
    </div>
  );
}
