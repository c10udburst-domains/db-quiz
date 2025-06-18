class QuizApp {
    constructor() {
        this.questions = [];
        this.currentQuestion = null;
        this.currentQuestionIndex = null;
        this.correctOptionsSet = new Set();
        this.shuffledOptions = [];
        
        this.scoreDisplay = document.getElementById('score-display');
        this.currentProb = document.getElementById('current-prob');
        this.stats = document.getElementById('stats');
        this.questionElement = document.getElementById('question');
        this.optionsContainer = document.getElementById('options-container');
        this.submitBtn = document.getElementById('submit-btn');
        this.continueBtn = document.getElementById('continue-btn');
        
        this.submitBtn.addEventListener('click', () => this.checkAnswer());
        this.continueBtn.addEventListener('click', () => this.loadQuestion());
        
        this.loadQuestions();
    }
    
    async loadQuestions() {
        try {
            const response = await fetch('q.csv');
            const csvText = await response.text();
            this.questions = this.parseCSV(csvText);
            this.loadScores();
            this.loadQuestion();
        } catch (error) {
            console.error('Error loading questions:', error);
            this.questionElement.textContent = 'Failed to load questions. Please try again later.';
        }
    }
    
    parseCSV(csvText) {
        const questions = [];
        const rows = csvText.split('\n').slice(1); // Skip header row
        
        for (const row of rows) {
            if (!row.trim()) continue;
            
            const cols = row.split(';').map(col => col.trim());
            if (cols.length < 9) continue;
            
            const question = cols[0];
            const options = cols.slice(1, 8).filter(opt => opt);
            const correct = cols[8].split(',').map(num => parseInt(num)).filter(num => !isNaN(num));
            
            if (question && options.length > 0 && correct.length > 0) {
                questions.push({
                    question,
                    options,
                    correct,
                    score: 1.0
                });
            }
        }
        
        return questions;
    }
    
    loadScores() {
        const savedScores = localStorage.getItem('quiz_scores');
        if (savedScores) {
            try {
                const scores = JSON.parse(savedScores);
                this.questions.forEach((q, i) => {
                    if (scores[i] !== undefined) q.score = scores[i];
                });
            } catch (e) {
                console.error('Error parsing saved scores:', e);
            }
        }
    }
    
    saveScores() {
        const scores = this.questions.map(q => q.score);
        localStorage.setItem('quiz_scores', JSON.stringify(scores));
    }
    
    updateScoreDisplay() {
        if (!this.currentQuestion) return;
        
        const currentScore = this.currentQuestion.score;
        const minScore = Math.min(...this.questions.map(q => q.score));
        const maxScore = Math.max(...this.questions.map(q => q.score));
        const sumScore = this.questions.reduce((sum, q) => sum + q.score, 0);
        
        this.currentProb.textContent = `current probability: ${currentScore.toFixed(2)}`;
        this.stats.textContent = `min: ${minScore.toFixed(2)}, max: ${maxScore.toFixed(2)}, total prob sum: ${sumScore.toFixed(2)}`;
    }
    
    loadQuestion() {
        if (this.questions.length === 0) return;
        
        this.optionsContainer.innerHTML = '';
        this.submitBtn.disabled = false;
        this.continueBtn.disabled = true;
        
        // Weighted random selection
        const totalWeight = this.questions.reduce((sum, q) => sum + q.score, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < this.questions.length; i++) {
            random -= this.questions[i].score;
            if (random <= 0) {
                this.currentQuestionIndex = i;
                this.currentQuestion = this.questions[i];
                break;
            }
        }
        
        this.updateScoreDisplay();
        this.questionElement.textContent = this.currentQuestion.question;
        
        // Prepare and shuffle options
        const indexedOptions = this.currentQuestion.options.map(
            (opt, idx) => [idx + 1, opt]
        );
        this.shuffle(indexedOptions);
        this.shuffledOptions = indexedOptions;
        this.correctOptionsSet = new Set(this.currentQuestion.correct);
        
        // Create option elements
        indexedOptions.forEach(([origIdx, text]) => {
            const optionId = `option-${origIdx}`;
            const optionDiv = document.createElement('div');
            optionDiv.className = 'form-control';
            
            const label = document.createElement('label');
            label.className = 'label cursor-pointer justify-start gap-2';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'checkbox checkbox-primary';
            checkbox.dataset.origIdx = origIdx;
            
            const span = document.createElement('span');
            span.className = 'label-text';
            span.textContent = text;
            
            label.appendChild(checkbox);
            label.appendChild(span);
            optionDiv.appendChild(label);
            this.optionsContainer.appendChild(optionDiv);
        });
    }
    
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    
    checkAnswer() {
        const checkboxes = this.optionsContainer.querySelectorAll('input[type="checkbox"]');
        const selected = new Set();
        
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selected.add(parseInt(checkbox.dataset.origIdx));
            }
        });
        
        // Update score
        const isCorrect = this.setEqual(selected, this.correctOptionsSet);
        if (isCorrect) {
            this.currentQuestion.score = Math.max(0.1, this.currentQuestion.score - 0.1);
        } else {
            this.currentQuestion.score = Math.min(2.0, this.currentQuestion.score + 0.1);
        }
        
        this.saveScores();
        this.updateScoreDisplay();
        
        // Mark correct answers
        checkboxes.forEach(checkbox => {
            checkbox.disabled = true;
            const origIdx = parseInt(checkbox.dataset.origIdx);
            
            if (this.correctOptionsSet.has(origIdx)) {
                checkbox.closest('.form-control').classList.add('bg-success', 'bg-opacity-20');
                checkbox.closest('label').classList.add('font-bold');
            }
        });
        
        this.submitBtn.disabled = true;
        this.continueBtn.disabled = false;
    }
    
    setEqual(setA, setB) {
        if (setA.size !== setB.size) return false;
        for (const item of setA) {
            if (!setB.has(item)) return false;
        }
        return true;
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new QuizApp();
});

// Save scores before page unload
window.addEventListener('beforeunload', () => {
    const scores = document.quizApp?.questions.map(q => q.score) || [];
    localStorage.setItem('quiz_scores', JSON.stringify(scores));
});
