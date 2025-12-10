// Global variables
let currentUser = null;
let currentBook = null;
let currentUnit = null;
let isReadingAloud = false;
let isSkimming = false;
let speechSynthesis = window.speechSynthesis;
let currentUtterance = null;
let skimmingInterval = null;
let readingSpeed = 1.0;
let foundWords = new Set();

// Initialize based on current page
document.addEventListener('DOMContentLoaded', function() {
    const currentPage = window.location.pathname.split('/').pop();
    
    // Check login status
    const savedUser = localStorage.getItem('readingUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
    }
    
    // Redirect if not logged in (except login page)
    if (!currentUser && currentPage !== 'index.html' && currentPage !== '') {
        window.location.href = 'index.html';
        return;
    }
    
    // Initialize specific page
    switch(currentPage) {
        case 'index.html':
        case '':
            initLoginPage();
            break;
        case 'books.html':
            initBooksPage();
            break;
        case 'unit.html':
            initUnitPage();
            break;
    }
});

// ===== LOGIN PAGE =====
function initLoginPage() {
    const loginForm = document.getElementById('loginForm');
    const lastLoginField = document.getElementById('lastLogin');
    
    if (!loginForm) return;
    
    // Check last login
    const lastLogin = localStorage.getItem('lastUserLogin');
    if (lastLogin) {
        const date = new Date(lastLogin);
        lastLoginField.value = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
    
    // Handle form submission
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const name = document.getElementById('name').value.trim();
        const surname = document.getElementById('surname').value.trim();
        const group = document.getElementById('group').value;
        
        if (!name || !surname || !group) {
            alert('Please fill in all fields');
            return;
        }
        
        // Create user
        currentUser = {
            id: Date.now().toString(),
            name: name,
            surname: surname,
            group: group,
            loginTime: new Date().toISOString()
        };
        
        // Save to localStorage
        localStorage.setItem('readingUser', JSON.stringify(currentUser));
        localStorage.setItem('lastUserLogin', currentUser.loginTime);
        
        // Show loading
        const button = document.querySelector('.btn-login');
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entering...';
        button.disabled = true;
        
        // Redirect
        setTimeout(() => {
            window.location.href = 'books.html';
        }, 1000);
    });
    
    // Auto-focus
    document.getElementById('name').focus();
}

// ===== BOOKS PAGE =====
function initBooksPage() {
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }
    
    // Display user info
    displayUserInfo();
    
    // Load books
    loadBooks();
}

function displayUserInfo() {
    const userInfoElement = document.getElementById('userInfo');
    if (userInfoElement && currentUser) {
        userInfoElement.innerHTML = `
            <div class="user-details">
                <div class="user-name">${currentUser.name} ${currentUser.surname}</div>
                <div class="user-group">${currentUser.group}</div>
            </div>
        `;
    }
}

async function loadBooks() {
    try {
        const response = await fetch('books.json');
        const data = await response.json();
        const booksGrid = document.getElementById('booksGrid');
        
        if (!booksGrid) return;
        
        booksGrid.innerHTML = '';
        
        data.books.forEach(book => {
            const bookCard = document.createElement('div');
            bookCard.className = `book-card ${book.status}`;
            
            if (book.status === 'available') {
                bookCard.onclick = () => {
                    localStorage.setItem('currentBook', JSON.stringify(book));
                    window.location.href = `unit.html?book=${book.id}&unit=1.1`;
                };
            }
            
            bookCard.innerHTML = `
                <div class="book-cover">
                    <i class="fas fa-book-open"></i>
                </div>
                <div class="book-info">
                    <h3>${book.title}</h3>
                    <p>${book.description}</p>
                    <div class="book-status ${book.status}">
                        ${book.status === 'available' ? 'Available Now' : 'Coming Soon'}
                    </div>
                </div>
            `;
            
            booksGrid.appendChild(bookCard);
        });
        
    } catch (error) {
        console.error('Error loading books:', error);
        document.getElementById('booksGrid').innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load books. Please refresh the page.</p>
            </div>
        `;
    }
}

// ===== UNIT PAGE =====
function initUnitPage() {
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }
    
    displayUserInfo();
    loadUnitData();
    initReadingFeatures();
}

async function loadUnitData() {
    try {
        const response = await fetch('books.json');
        const data = await response.json();
        currentBook = data.books[0];
        currentUnit = currentBook.units[0];
        
        // Update UI
        updateUnitHeader();
        updateTextContent();
        updateVocabularySection();
        updateGrammarSection();
        updateExercisesSection();
        
        // Highlight vocabulary words
        highlightVocabularyWords();
        
    } catch (error) {
        console.error('Error loading unit:', error);
        document.getElementById('unitHeader').innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load unit. Please refresh the page.</p>
            </div>
        `;
    }
}

function updateUnitHeader() {
    const unitHeader = document.getElementById('unitHeader');
    if (unitHeader && currentBook && currentUnit) {
        unitHeader.innerHTML = `
            <h1>${currentBook.title}</h1>
            <h2>Unit ${currentUnit.id}: ${currentUnit.title}</h2>
            <p>Read the text and complete the exercises below</p>
        `;
    }
}

function updateTextContent() {
    const textContent = document.getElementById('textContent');
    if (textContent && currentUnit) {
        const paragraphs = currentUnit.text.split('\n\n');
        textContent.innerHTML = paragraphs.map(p => `<p>${p}</p>`).join('');
    }
}

function highlightVocabularyWords() {
    if (!currentUnit || !currentUnit.vocabulary) return;
    
    const textContent = document.getElementById('textContent');
    if (!textContent) return;
    
    const words = currentUnit.vocabulary.map(v => v.word.toLowerCase());
    let html = textContent.innerHTML;
    
    words.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        html = html.replace(regex, `<span class="vocab-word" data-word="${word}">$&</span>`);
    });
    
    textContent.innerHTML = html;
    
    // Add click events
    document.querySelectorAll('.vocab-word').forEach(span => {
        span.addEventListener('click', function() {
            const word = this.dataset.word;
            showVocabPopup(word);
            
            // Mark as found
            if (!foundWords.has(word)) {
                foundWords.add(word);
                updateVocabStats();
            }
        });
    });
}

function updateVocabularySection() {
    const vocabularyGrid = document.getElementById('vocabularyGrid');
    if (!vocabularyGrid || !currentUnit || !currentUnit.vocabulary) return;
    
    vocabularyGrid.innerHTML = currentUnit.vocabulary.map(vocab => {
        const isFound = foundWords.has(vocab.word.toLowerCase());
        return `
            <div class="vocab-card ${isFound ? 'found' : ''}" data-word="${vocab.word.toLowerCase()}">
                <div class="word">${vocab.word}</div>
                <div class="translation">${vocab.translation}</div>
                <div style="font-size: 0.9rem; color: #666; margin-top: 8px;">
                    Click to see details
                </div>
            </div>
        `;
    }).join('');
    
    // Add click events
    document.querySelectorAll('.vocab-card').forEach(card => {
        card.addEventListener('click', function() {
            const word = this.dataset.word;
            showVocabPopup(word);
            
            if (!foundWords.has(word)) {
                foundWords.add(word);
                this.classList.add('found');
                updateVocabStats();
            }
        });
    });
    
    updateVocabStats();
}

function updateVocabStats() {
    const total = currentUnit.vocabulary.length;
    const found = foundWords.size;
    const notFound = total - found;
    
    document.getElementById('foundCount').textContent = found;
    document.getElementById('notFoundCount').textContent = notFound;
}

function updateGrammarSection() {
    const grammarContent = document.getElementById('grammarContent');
    if (!grammarContent || !currentUnit || !currentUnit.grammar) return;
    
    const grammar = currentUnit.grammar;
    grammarContent.innerHTML = `
        <h4>${grammar.theme}</h4>
        <p>${grammar.description}</p>
        <div class="grammar-examples">
            <h5>Examples:</h5>
            <ul>
                ${grammar.examples.map(example => `<li>${example}</li>`).join('')}
            </ul>
        </div>
    `;
}

function updateExercisesSection() {
    const exercisesGrid = document.getElementById('exercisesGrid');
    if (!exercisesGrid || !currentUnit || !currentUnit.exercises) return;
    
    exercisesGrid.innerHTML = currentUnit.exercises.map((exercise, index) => `
        <div class="exercise-card" data-index="${index}">
            <div class="exercise-header">
                <h4>${getExerciseType(exercise.type)}</h4>
                <span class="exercise-number">${index + 1}</span>
            </div>
            <div class="exercise-question">${exercise.question}</div>
            <div class="exercise-options">
                ${exercise.options.map((option, optIndex) => `
                    <div class="option" data-index="${optIndex}">
                        <span class="option-letter">${String.fromCharCode(65 + optIndex)}</span>
                        <span class="option-text">${option}</span>
                    </div>
                `).join('')}
            </div>
            <button class="check-btn" onclick="checkAnswer(${index})">
                Check Answer
            </button>
            <div class="feedback" style="display: none; margin-top: 15px; padding: 10px; border-radius: 5px;"></div>
        </div>
    `).join('');
    
    // Add click events to options
    document.querySelectorAll('.option').forEach(option => {
        option.addEventListener('click', function() {
            const card = this.closest('.exercise-card');
            card.querySelectorAll('.option').forEach(opt => {
                opt.classList.remove('selected');
            });
            this.classList.add('selected');
        });
    });
}

function getExerciseType(type) {
    const types = {
        'definition': 'Definition',
        'gap-filling': 'Gap Filling',
        'english-uzbek': 'English → Uzbek',
        'uzbek-english': 'Uzbek → English'
    };
    return types[type] || 'Exercise';
}

function checkAnswer(exerciseIndex) {
    const card = document.querySelector(`.exercise-card[data-index="${exerciseIndex}"]`);
    const selectedOption = card.querySelector('.option.selected');
    const feedback = card.querySelector('.feedback');
    
    if (!selectedOption) {
        alert('Please select an answer first!');
        return;
    }
    
    const selectedIndex = parseInt(selectedOption.dataset.index);
    const exercise = currentUnit.exercises[exerciseIndex];
    const isCorrect = selectedIndex === exercise.correct;
    
    // Show result
    if (isCorrect) {
        selectedOption.classList.add('correct');
        feedback.innerHTML = '<span style="color: green;"><i class="fas fa-check-circle"></i> Correct! Well done!</span>';
        feedback.style.display = 'block';
        feedback.style.background = '#d1fae5';
    } else {
        selectedOption.classList.add('incorrect');
        // Show correct answer
        card.querySelectorAll('.option').forEach((opt, idx) => {
            if (idx === exercise.correct) {
                opt.classList.add('correct');
            }
        });
        feedback.innerHTML = '<span style="color: red;"><i class="fas fa-times-circle"></i> Incorrect. Try again!</span>';
        feedback.style.display = 'block';
        feedback.style.background = '#fee2e2';
    }
    
    // Disable further clicks
    card.querySelectorAll('.option').forEach(opt => {
        opt.style.pointerEvents = 'none';
    });
    card.querySelector('.check-btn').disabled = true;
}

function showVocabPopup(word) {
    const vocab = currentUnit.vocabulary.find(v => v.word.toLowerCase() === word.toLowerCase());
    if (!vocab) return;
    
    const popup = document.getElementById('vocabPopup');
    const popupBody = document.getElementById('popupBody');
    
    popupBody.innerHTML = `
        <div class="vocab-popup-header">
            <h3>${vocab.word}</h3>
            <div style="color: #4ade80; font-weight: 500;">${vocab.translation}</div>
        </div>
        <div style="margin-bottom: 20px;">
            <h4 style="color: #666; margin-bottom: 5px;">Definition:</h4>
            <p>${vocab.definition}</p>
        </div>
        <div>
            <h4 style="color: #666; margin-bottom: 5px;">Example:</h4>
            <p style="font-style: italic;">"${vocab.example}"</p>
        </div>
        <div style="margin-top: 20px; padding: 15px; background: #f0f9ff; border-radius: 5px;">
            <i class="fas fa-lightbulb" style="color: #f59e0b;"></i>
            <span style="margin-left: 10px;">This word appears in the text above</span>
        </div>
    `;
    
    popup.style.display = 'flex';
}

function closeVocabPopup() {
    document.getElementById('vocabPopup').style.display = 'none';
}

// ===== READING FEATURES =====
function initReadingFeatures() {
    // Read Aloud
    const readAloudBtn = document.getElementById('readAloudBtn');
    if (readAloudBtn) {
        readAloudBtn.addEventListener('click', toggleReadAloud);
    }
    
    // Skimming
    const skimmingBtn = document.getElementById('skimmingBtn');
    if (skimmingBtn) {
        skimmingBtn.addEventListener('click', toggleSkimming);
    }
    
    // Speed control
    const speedControl = document.getElementById('readingSpeed');
    const speedValue = document.getElementById('speedValue');
    
    if (speedControl && speedValue) {
        speedControl.addEventListener('input', function(e) {
            readingSpeed = parseInt(e.target.value) / 100;
            speedValue.textContent = readingSpeed.toFixed(1) + 'x';
            
            // Update current utterance if playing
            if (isReadingAloud && currentUtterance) {
                currentUtterance.rate = readingSpeed;
            }
        });
    }
}

function toggleReadAloud() {
    const textContent = document.getElementById('textContent');
    const button = document.getElementById('readAloudBtn');
    
    if (!textContent || !speechSynthesis) {
        alert('Text-to-speech is not supported in your browser');
        return;
    }
    
    if (isReadingAloud) {
        // Stop
        speechSynthesis.cancel();
        isReadingAloud = false;
        button.classList.remove('active');
        button.innerHTML = '<i class="fas fa-volume-up"></i> <span>Read Aloud</span>';
    } else {
        // Start
        const text = textContent.textContent;
        currentUtterance = new SpeechSynthesisUtterance(text);
        currentUtterance.rate = readingSpeed;
        currentUtterance.pitch = 1;
        currentUtterance.volume = 1;
        
        currentUtterance.onstart = function() {
            isReadingAloud = true;
            button.classList.add('active');
            button.innerHTML = '<i class="fas fa-stop"></i> <span>Stop Reading</span>';
        };
        
        currentUtterance.onend = function() {
            isReadingAloud = false;
            button.classList.remove('active');
            button.innerHTML = '<i class="fas fa-volume-up"></i> <span>Read Aloud</span>';
        };
        
        currentUtterance.onerror = function(event) {
            console.error('Speech synthesis error:', event);
            isReadingAloud = false;
            button.classList.remove('active');
            button.innerHTML = '<i class="fas fa-volume-up"></i> <span>Read Aloud</span>';
            alert('Error reading text. Please try again.');
        };
        
        speechSynthesis.speak(currentUtterance);
    }
}

function toggleSkimming() {
    const textContent = document.getElementById('textContent');
    const button = document.getElementById('skimmingBtn');
    
    if (!textContent) return;
    
    if (isSkimming) {
        // Stop
        clearInterval(skimmingInterval);
        isSkimming = false;
        button.classList.remove('active');
        button.innerHTML = '<i class="fas fa-running"></i> <span>Skimming</span>';
        
        // Restore text
        const paragraphs = currentUnit.text.split('\n\n');
        textContent.innerHTML = paragraphs.map(p => `<p>${p}</p>`).join('');
        highlightVocabularyWords();
    } else {
        // Start
        isSkimming = true;
        button.classList.add('active');
        button.innerHTML = '<i class="fas fa-stop"></i> <span>Stop Skimming</span>';
        
        const text = currentUnit.text;
        let position = 0;
        
        skimmingInterval = setInterval(() => {
            if (position >= text.length || !isSkimming) {
                clearInterval(skimmingInterval);
                isSkimming = false;
                button.classList.remove('active');
                button.innerHTML = '<i class="fas fa-running"></i> <span>Skimming</span>';
                return;
            }
            
            position++;
            const visibleText = text.substring(0, position);
            const hiddenText = text.substring(position);
            
            textContent.innerHTML = `
                <span style="color: #1f2937;">${visibleText}</span>
                <span style="color: transparent;">${hiddenText}</span>
            `;
        }, 50); // Speed of skimming
    }
}

// Close popup when clicking outside
document.addEventListener('click', function(event) {
    const popup = document.getElementById('vocabPopup');
    if (popup && event.target === popup) {
        closeVocabPopup();
    }
});

// Close popup with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeVocabPopup();
    }
});
