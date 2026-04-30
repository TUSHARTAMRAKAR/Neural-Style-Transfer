/**
 * useJobPoller.js — Custom React hook
 *
 * Polls /status/{jobId} every 3 seconds until the job is done.
 * Exposes status, progress, and result URL to any component.
 *
 * Usage:
 *   const { status, progress, resultUrl, error } = useJobPoller(jobId);
 */

import { useState, useEffect, useRef } from "react";
import { fetchJobStatus } from "../utils/api";

const POLL_INTERVAL_MS = 3000; // poll every 3 seconds

export function useJobPoller(jobId) {
  const [status,     setStatus]     = useState(null);
  const [progress,   setProgress]   = useState(0);
  const [step,       setStep]       = useState(0);
  const [totalSteps, setTotalSteps] = useState(300);
  const [losses,     setLosses]     = useState({ content: null, style: null, total: null });
  const [resultUrl,  setResultUrl]  = useState(null);
  const [error,      setError]      = useState(null);

  const intervalRef = useRef(null);

  useEffect(() => {
    if (!jobId) return;

    // Reset state when jobId changes
    setStatus("pending");
    setProgress(0);
    setStep(0);
    setResultUrl(null);
    setError(null);

    const poll = async () => {
      try {
        const data = await fetchJobStatus(jobId);

        setStatus(data.status);
        setProgress(data.progress);
        setStep(data.step);
        setTotalSteps(data.total_steps);
        setLosses({
          content: data.content_loss,
          style:   data.style_loss,
          total:   data.total_loss,
        });

        if (data.status === "completed") {
          setResultUrl(data.result_url);
          clearInterval(intervalRef.current);
        } else if (data.status === "failed") {
          setError(data.error || "Style transfer failed.");
          clearInterval(intervalRef.current);
        }
      } catch (err) {
        setError(err.message);
        clearInterval(intervalRef.current);
      }
    };

    // Poll immediately, then on interval
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => clearInterval(intervalRef.current);
  }, [jobId]);

  return { status, progress, step, totalSteps, losses, resultUrl, error };
}
