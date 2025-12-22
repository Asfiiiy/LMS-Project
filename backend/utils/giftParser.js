/**
 * GIFT Format Parser for CPD Quizzes
 * Parses Moodle GIFT format into question objects
 */

function parseGiftFormat(giftText) {
  if (!giftText || typeof giftText !== 'string') {
    console.log('[GIFT Parser] Invalid input - empty or not a string');
    return [];
  }

  const questions = [];
  const lines = giftText.split('\n');
  let currentQuestion = null;
  let inOptions = false;

  console.log('[GIFT Parser] Processing', lines.length, 'lines');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and comments at the start
    if (!line || (line.startsWith('//') && !inOptions && !currentQuestion)) {
      continue;
    }

    // Start new question when we see a comment line (if we have a previous question)
    if (line.startsWith('//') && currentQuestion && currentQuestion.question_text) {
      // Save previous question
      questions.push(currentQuestion);
      currentQuestion = null;
      inOptions = false;
      continue;
    }

    // Question title line (::title::)
    if (line.startsWith('::') && line.endsWith('::')) {
      // Start new question
      currentQuestion = {
        question_text: '',
        question_type: 'multiple_choice',
        points: 1,
        options: []
      };
      continue;
    }

    // Opening brace - start of options
    if (line === '{') {
      inOptions = true;
      continue;
    }

    // Closing brace - end of options
    if (line === '}') {
      inOptions = false;
      // Save question after closing brace
      if (currentQuestion && currentQuestion.question_text) {
        questions.push(currentQuestion);
        currentQuestion = null;
      }
      continue;
    }

    // Inside options block
    if (inOptions && currentQuestion) {
      if (line.startsWith('==')) {
        // Correct answer
        currentQuestion.options.push({
          text: line.substring(2).trim(),
          is_correct: true
        });
      } else if (line.startsWith('~~')) {
        // Wrong answer
        currentQuestion.options.push({
          text: line.substring(2).trim(),
          is_correct: false
        });
      } else if (line.startsWith('~') && !line.startsWith('~~')) {
        // Single tilde - also wrong answer
        currentQuestion.options.push({
          text: line.substring(1).trim(),
          is_correct: false
        });
      } else if (line.startsWith('=') && !line.startsWith('==')) {
        // Single = - also a correct answer
        currentQuestion.options.push({
          text: line.substring(1).trim(),
          is_correct: true
        });
      }
    } else if (currentQuestion && !inOptions && line && !line.startsWith('//') && !line.startsWith('::')) {
      // Question text (before options block)
      if (currentQuestion.question_text) {
        currentQuestion.question_text += ' ' + line;
      } else {
        currentQuestion.question_text = line;
      }
    }
  }

  // Add the last question if exists
  if (currentQuestion && currentQuestion.question_text) {
    questions.push(currentQuestion);
  }

  console.log('[GIFT Parser] Total questions found:', questions.length);

  // Validate questions
  const validQuestions = questions.filter((q, idx) => {
    const isValid = q.question_text && 
           q.options && 
           q.options.length > 0 && 
           q.options.some(opt => opt.is_correct);
    
    if (!isValid) {
      console.log('[GIFT Parser] Invalid question at index', idx, ':', {
        hasText: !!q.question_text,
        optionsCount: q.options ? q.options.length : 0,
        hasCorrect: q.options ? q.options.some(opt => opt.is_correct) : false
      });
    }
    return isValid;
  });

  console.log('[GIFT Parser] Valid questions:', validQuestions.length);
  return validQuestions;
}

module.exports = {
  parseGiftFormat
};

