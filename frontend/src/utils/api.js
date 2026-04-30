/**
 * api.js — All API calls to the FastAPI backend
 *
 * BASE_URL points to /api in dev (Vite proxies to :8000)
 * In production (HF Spaces), set VITE_API_URL env var.
 */

const BASE_URL = import.meta.env.VITE_API_URL || "/api";

/** Fetch all available style presets */
export async function fetchStyles() {
  const res = await fetch(`${BASE_URL}/styles`);
  if (!res.ok) throw new Error("Failed to fetch styles");
  return res.json(); // { presets: [...] }
}

/**
 * Submit a style transfer job.
 * @param {File}   contentFile  - user's photo
 * @param {File|null} styleFile - custom artwork (null if using preset)
 * @param {string|null} preset  - preset key (null if using custom style)
 * @param {object} params       - { num_steps, content_weight, style_weight }
 * @returns {{ job_id, message, status }}
 */
export async function submitStylizeJob(contentFile, styleFile, preset, params = {}) {
  const formData = new FormData();
  formData.append("content_image", contentFile);

  if (styleFile) {
    formData.append("style_image", styleFile);
  }
  if (preset) {
    formData.append("preset", preset);
  }

  formData.append("num_steps",      params.num_steps      ?? 400);
  formData.append("content_weight", params.content_weight ?? 1000);
  formData.append("style_weight",   params.style_weight   ?? 1000000000);

  const res = await fetch(`${BASE_URL}/stylize`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || "Stylize request failed");
  }

  return res.json();
}

/**
 * Poll job status.
 * @param {string} jobId
 * @returns {StatusResponse}
 */
export async function fetchJobStatus(jobId) {
  const res = await fetch(`${BASE_URL}/status/${jobId}`);
  if (!res.ok) throw new Error(`Failed to fetch status for job ${jobId}`);
  return res.json();
}

/** Returns the URL to display/download the result image */
export function getResultUrl(jobId) {
  return `${BASE_URL}/result/${jobId}`;
}

/** Delete a job and its files */
export async function deleteJob(jobId) {
  await fetch(`${BASE_URL}/job/${jobId}`, { method: "DELETE" });
}
