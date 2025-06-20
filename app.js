class QuizApp {
    constructor() {
        this.questions = [];
        this.currentQuestion = null;
        this.currentQuestionIndex = null;
        this.correctOptionsSet = new Set();
        this.shuffledOptions = [];
        this.sources = [];
        this.pdf_url = 'https://wutwaw.sharepoint.com/sites/F3FE83EE-07DD-47E8-86F9-2C0E6BAFB4A1.teams/Shared%20Documents/wyk%C5%82ady/';
        
        this.scoreDisplay = document.getElementById('score-display');
        this.currentProb = document.getElementById('current-prob');
        this.stats = document.getElementById('stats');
        this.questionElement = document.getElementById('question');
        this.optionsContainer = document.getElementById('options-container');
        this.submitBtn = document.getElementById('submit-btn');
        this.continueBtn = document.getElementById('continue-btn');
        this.sourcesFooter = document.getElementById('sources-footer');
        
        this.submitBtn.addEventListener('click', () => this.checkAnswer());
        this.continueBtn.addEventListener('click', () => this.loadQuestion());
        
        this.loadQuestions();
        this.loadSources();
    }
    
    async loadQuestions() {
        try {
            const response = await fetch('q.csv');
            const csvText = await response.text();
            this.questions = this.parseCSV(csvText);
            this.loadScores();
        } catch (error) {
            console.error('Error loading questions:', error);
            this.questionElement.textContent = 'Failed to load questions. Please try again later.';
        }
    }

    async loadSources() {
        try {
            const response = await fetch('pdf.txt');
            const text = await response.text();
            this.sources = text.split('\n').map(line => 
                line.split(', ').map(pdf => pdf.trim())
            );
            this.loadQuestion();
        } catch (error) {
            console.error('Error loading sources:', error);
        }
    }
    
    parseCSV(csvText) {
        const questions = [];
        const rows = csvText.split('\n').slice(1); // Skip header row
    
        for (const row of rows) {
            if (!row.trim()) continue;
    
            // Robust CSV parsing with support for quoted values
            const cols = [];
            let current = '';
            let inQuotes = false;
    
            for (let i = 0; i < row.length; i++) {
                const char = row[i];
                const nextChar = row[i + 1];
    
                if (char === '"') {
                    if (inQuotes && nextChar === '"') {
                        current += '"'; // Escaped quote
                        i++; // Skip the next quote
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ';' && !inQuotes) {
                    cols.push(current.trim().replace(/^"|"$/g, ''));
                    current = '';
                } else {
                    current += char;
                }
            }
            cols.push(current.trim().replace(/^"|"$/g, ''));
    
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

        this.displaySources();
    }

    displaySources() {
        this.sourcesFooter.innerHTML = '';
        
        if (!this.currentQuestionIndex || 
            !this.sources[this.currentQuestionIndex] ||
            this.sources[this.currentQuestionIndex].length === 0) {
            return;
        }
        
        const sourceText = document.createElement('p');
        sourceText.className = 'text-sm mt-4 text-gray-600';
        sourceText.textContent = '';
        
        this.sources[this.currentQuestionIndex].forEach((pdf, index) => {
            const link = document.createElement('a');
            link.href = `${this.pdf_url}${encodeURIComponent(pdf)}`;
            link.textContent = pdf;
            link.className = 'mx-1';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            
            sourceText.appendChild(link);
            
            if (index < this.sources[this.currentQuestionIndex].length - 1) {
                sourceText.appendChild(document.createTextNode(', '));
            }
        });
        
        this.sourcesFooter.appendChild(sourceText);
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
            this.currentQuestion.score = Math.max(0.1, this.currentQuestion.score - 0.4);
        } else {
            this.currentQuestion.score = Math.min(3.0, this.currentQuestion.score + 0.4);
        }
        
        this.saveScores();
        this.updateScoreDisplay();
        
        // Mark correct answers with green color
        checkboxes.forEach(checkbox => {
            checkbox.disabled = true;
            const origIdx = parseInt(checkbox.dataset.origIdx);
            const label = checkbox.parentElement;
            const textSpan = label.querySelector('.label-text');
            
            if (this.correctOptionsSet.has(origIdx)) {
                // Change checkbox to green
                checkbox.classList.remove('checkbox-primary');
                checkbox.classList.add('checkbox-success');
                // Make text green and bold
                textSpan.classList.add('text-success', 'font-bold');
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
