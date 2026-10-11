export async function retryByDate({ date, maxAttempts, delaysMs, operation, onAttemptFailure }) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      await onAttemptFailure?.({ date, attempt, error });

      if (attempt < maxAttempts) {
        await sleep(delaysMs[Math.min(attempt - 1, delaysMs.length - 1)] ?? 0);
      }
    }
  }

  throw lastError;
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

