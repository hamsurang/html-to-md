export function extractStackOverflow() {
  const parts = [];

  // Question title
  const titleEl = document.querySelector('#question-header h1 a, #question-header h1');
  if (titleEl) {
    parts.push(`<h1>${titleEl.textContent.trim()}</h1>`);
  }

  // Question body
  const questionBody = document.querySelector('#question .s-prose');
  if (questionBody) {
    parts.push(questionBody.outerHTML);
  }

  // Answers
  const answers = document.querySelectorAll('#answers .answer');
  for (const answer of answers) {
    const voteEl = answer.querySelector('.js-vote-count');
    const vote = voteEl ? voteEl.textContent.trim() : '0';
    const isAccepted = answer.classList.contains('accepted-answer');
    const acceptedMark = isAccepted ? ' ✓ Accepted' : '';

    parts.push(`<h2>Answer (Score: ${vote})${acceptedMark}</h2>`);

    const body = answer.querySelector('.s-prose');
    if (body) {
      parts.push(body.outerHTML);
    }

    parts.push('<hr>');
  }

  return parts.length > 1 ? parts.join('\n') : null;
}
