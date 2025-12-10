// ============================================
// READMASTER READING PLATFORM - MAIN SCRIPT
// ============================================

// Global Variables
let currentUser = null;
let currentBook = null;
let currentUnit = null;
let speechSynthesis = window.speechSynthesis || null;
let currentUtterance = null;
let isReadingAloud = false;
let isSkimming = false;
let skimmingInterval = null;
let readingSpeed = 1.0;
let skimmingSpeed = 50;
let foundWords = new Set();
let userProgress = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Get current page
    const currentPage = window.location.pathname.split('/').pop();
    
    // Initialize based on current page
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
        case 'book.html':
            // Handle book page if it exists
            window.location.href = 'books.html';
            break;
    }
});

// ============================================
// LOGIN PAGE FUNCTIONS
// ============================================

function initLoginPage() {
    console.log('Initializing login page...');
    
    // Check if already logged in
    const savedUser = localStorage.getItem('readingUser');
    if (savedUser) {
        // Redirect to books page
        window.location.href = 'books.html';
        return;
    }
    
    // Get form elements
    const loginForm = document.getElementById('loginForm');
    const nameInput = document.getElementById('name');
    const surnameInput = document.getElementById('surname');
    const groupSelect = document.getElementById('group');
    const lastLoginInput = document.getElementById('lastLogin');
    
    if (!loginForm) {
        console.error('Login form not found!');
        return;
    }
    
    // Set last login time
    const lastLogin = localStorage.getItem('lastLoginTime');
    if (lastLogin) {
        const date = new Date(lastLogin);
        lastLoginInput.value = formatDateTime(date);
    } else {
        lastLoginInput.value = 'First time login';
    }
    
    // Set current time as placeholder
    lastLoginInput.placeholder = formatDateTime(new Date());
    
    // Handle form submission
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handleLogin();
    });
    
    // Handle Enter key in inputs
    [nameInput, surnameInput, groupSelect].forEach(input => {
        if (input) {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLogin();
                }
            });
        }
    });
    
    // Auto-focus first input
    if (nameInput) {
        nameInput.focus();
    }
}

function handleLogin() {
    const name = document.getElementById('name')?.value.trim();
    const surname = document.getElementById('surname')?.value.trim();
    const group = document.getElementById('group')?.value;
    
    // Validate inputs
    if (!name || !surname || !group) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    // Create user object
    currentUser = {
        id: `${name}_${surname}_${group}`.toLowerCase().replace(/\s+/g, '_'),
        name: name,
        surname: surname,
        group: group,
        loginTime: new Date().toISOString(),
        lastLogin: localStorage.getItem(`lastLogin_${name}_${surname}_${group}`) || null
    };
    
    // Save user data
    localStorage.setItem('readingUser', JSON.stringify(currentUser));
    localStorage.setItem('lastLoginTime', currentUser.loginTime);
    localStorage.setItem(`lastLogin_${name}_${surname}_${group}`, currentUser.loginTime);
    
    // Initialize user progress if not exists
    if (!localStorage.getItem(`progress_${currentUser.id}`)) {
        userProgress = {
            completedUnits: [],
            vocabularyFound: {},
            exerciseScores: {}
        };
        localStorage.setItem(`progress_${currentUser.id}`, JSON.stringify(userProgress));
    } else {
        userProgress = JSON.parse(localStorage.getItem(`progress_${currentUser.id}`));
    }
    
    // Show loading state
    const submitBtn = document.querySelector('.btn-login');
    if (submitBtn) {
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entering Platform...';
        submitBtn.disabled = true;
        
        // Simulate loading and redirect
        setTimeout(() => {
            window.location.href = 'books.html';
        }, 1500);
    }
}

// ============================================
// BOOKS PAGE FUNCTIONS
// ============================================

function initBooksPage() {
    console.log('Initializing books page...');
    
    // Check if user is logged in
    const savedUser = localStorage.getItem('readingUser');
    if (!savedUser) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = JSON.parse(savedUser);
    userProgress = JSON.parse(localStorage.getItem(`progress_${currentUser.id}`)) || {};
    
    // Display user info
    displayUserInfo();
    
    // Load books
    loadBooks();
    
    // Setup event listeners
    setupBooksPageEvents();
}

function displayUserInfo() {
    const userInfoContainer = document.getElementById('userInfo') || document.querySelector('.user-info');
    if (userInfoContainer && currentUser) {
        const lastLogin = currentUser.lastLogin ? 
            `Last login: ${formatDateTime(new Date(currentUser.lastLogin))}` : 
            'First time here!';
        
        userInfoContainer.innerHTML = `
            <div class="user-details">
                <div class="user-name">${currentUser.name} ${currentUser.surname}</div>
                <div class="user-group">${currentUser.group}</div>
                <div class="user-last-login">${lastLogin}</div>
            </div>
            <button class="logout-btn" onclick="logout()">
                <i class="fas fa-sign-out-alt"></i> Logout
            </button>
        `;
    }
}

async function loadBooks() {
    try {
        const response = await fetch('api/books.json');
        const data = await response.json();
        currentBook = data.books[0];
        
        const booksGrid = document.getElementById('booksGrid') || document.querySelector('.books-grid');
        if (!booksGrid) return;
        
        booksGrid.innerHTML = '';
        
        data.books.forEach(book => {
            const bookCard = document.createElement('div');
            bookCard.className = `book-card ${book.status}`;
            
            // Check progress for this book
            const progress = userProgress.completedUnits || [];
            const completedCount = progress.filter(unit => unit.startsWith(book.id)).length;
            const totalUnits = book.units?.filter(unit => unit.status !== 'locked').length || 0;
            const progressPercent = totalUnits > 0 ? Math.round((completedCount / totalUnits) * 100) : 0;
            
            bookCard.innerHTML = `
                <div class="book-cover">
                    <div class="book-icon">${book.image || '📚'}</div>
                    ${book.status === 'available' ? 
                        `<div class="book-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progressPercent}%"></div>
                            </div>
                            <span>${progressPercent}% Complete</span>
                        </div>` : 
                        `<div class="coming-soon">Coming Soon</div>`
                    }
                </div>
                <div class="book-info">
                    <h3>${book.title}</h3>
                    <p>${book.description}</p>
                    <div class="book-meta">
                        <span><i class="fas fa-book-open"></i> ${book.units?.length || 0} Units</span>
                        <span><i class="fas fa-clock"></i> ${book.units?.length * 15 || 0} min</span>
                    </div>
                    <div class="book-status ${book.status}">
                        <i class="fas ${book.status === 'available' ? 'fa-lock-open' : 'fa-lock'}"></i>
                        ${book.status === 'available' ? 'Available Now' : 'Coming Soon'}
                    </div>
                </div>
            `;
            
            if (book.status === 'available') {
                bookCard.style.cursor = 'pointer';
                bookCard.addEventListener('click', () => {
                    localStorage.setItem('currentBook', JSON.stringify(book));
                    if (book.units && book.units[0]) {
                        window.location.href = `unit.html?book=${book.id}&unit=${book.units[0].id}`;
                    }
                });
            } else {
                bookCard.style.opacity = '0.7';
                bookCard.style.cursor = 'not-allowed';
            }
            
            booksGrid.appendChild(bookCard);
        });
        
    } catch (error) {
        console.error('Error loading books:', error);
        showToast('Error loading books. Please try again.', 'error');
        
        const booksGrid = document.getElementById('booksGrid') || document.querySelector('.books-grid');
        if (booksGrid) {
            booksGrid.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Unable to Load Books</h3>
                    <p>There was an error loading the books. Please check your connection.</p>
                    <button onclick="loadBooks()" class="retry-btn">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
    }
}

function setupBooksPageEvents() {
    // Search functionality (if implemented)
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(filterBooks, 300));
    }
}

function filterBooks(searchTerm) {
    // Implement book filtering if needed
}

// ============================================
// UNIT PAGE FUNCTIONS
// ============================================

function initUnitPage() {
    console.log('Initializing unit page...');
    
    // Check if user is logged in
    const savedUser = localStorage.getItem('readingUser');
    if (!savedUser) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = JSON.parse(savedUser);
    userProgress = JSON.parse(localStorage.getItem(`progress_${currentUser.id}`)) || {};
    
    // Display user info
    displayUserInfo();
    
    // Load unit data
    loadUnitData();
    
    // Initialize reading features
    initReadingFeatures();
    
    // Initialize exercises
    initExercises();
    
    // Setup event listeners
    setupUnitPageEvents();
}

async function loadUnitData() {
    try {
        // Get book and unit IDs from URL
        const urlParams = new URLSearchParams(window.location.search);
        const bookId = urlParams.get('book') || '1';
        const unitId = urlParams.get('unit') || '1.1';
        
        // Load books data
        const response = await fetch('api/books.json');
        const data = await response.json();
        
        // Find the book and unit
        const book = data.books.find(b => b.id == bookId);
        const unit = book?.units.find(u => u.id === unitId);
        
        if (!book || !unit) {
            throw new Error('Book or unit not found');
        }
        
        currentBook = book;
        currentUnit = unit;
        
        // Update page title
        document.title = `${unit.title} - ${book.title} - ReadMaster`;
        
        // Update unit header
        updateUnitHeader(book, unit);
        
        // Update text content
        updateTextContent(unit.text);
        
        // Update vocabulary section
        updateVocabularySection(unit.vocabulary);
        
        // Update grammar section
        updateGrammarSection(unit.grammar);
        
        // Update exercises section
        updateExercisesSection(unit.exercises || []);
        
        // Load user progress for this unit
        loadUserProgress(bookId, unitId);
        
    } catch (error) {
        console.error('Error loading unit data:', error);
        showToast('Error loading unit content. Please try again.', 'error');
        
        const unitHeader = document.getElementById('unitHeader');
        if (unitHeader) {
            unitHeader.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Unable to Load Unit</h3>
                    <p>There was an error loading the unit content.</p>
                    <button onclick="loadUnitData()" class="retry-btn">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                    <button onclick="window.location.href='books.html'" class="back-btn">
                        <i class="fas fa-arrow-left"></i> Back to Books
                    </button>
                </div>
            `;
        }
    }
}

function updateUnitHeader(book, unit) {
    const unitHeader = document.getElementById('unitHeader') || document.querySelector('.unit-header');
    if (unitHeader) {
        unitHeader.innerHTML = `
            <div class="unit-title-section">
                <nav class="unit-breadcrumb">
                    <a href="books.html"><i class="fas fa-arrow-left"></i> Bookshelf</a>
                    <span>/</span>
                    <span>${book.title}</span>
                    <span>/</span>
                    <span class="current-unit">Unit ${unit.id}</span>
                </nav>
                <h1>${unit.title}</h1>
                <div class="unit-meta">
                    <span><i class="fas fa-clock"></i> 15 min read</span>
                    <span><i class="fas fa-book"></i> ${countWords(unit.text)} words</span>
                    <span><i class="fas fa-star"></i> ${unit.vocabulary?.length || 0} vocabulary</span>
                </div>
            </div>
        `;
    }
}

function updateTextContent(text) {
    const textContent = document.getElementById('textContent') || document.querySelector('.text-content');
    if (textContent) {
        // Split into paragraphs and add readability classes
        const paragraphs = text.split('\n\n');
        textContent.innerHTML = paragraphs.map(p => 
            `<p class="reading-paragraph">${p}</p>`
        ).join('');
        
        // Highlight vocabulary words
        highlightVocabularyWords();
    }
}

function highlightVocabularyWords() {
    if (!currentUnit || !currentUnit.vocabulary) return;
    
    const textContent = document.getElementById('textContent') || document.querySelector('.text-content');
    if (!textContent) return;
    
    const vocabulary = currentUnit.vocabulary;
    
    vocabulary.forEach(vocab => {
        const word = vocab.word.toLowerCase();
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        
        textContent.innerHTML = textContent.innerHTML.replace(regex, 
            `<span class="vocab-highlight" data-word="${word}" title="Click for definition">$&</span>`
        );
    });
    
    // Add click events to highlighted words
    document.querySelectorAll('.vocab-highlight').forEach(span => {
        span.addEventListener('click', function() {
            const word = this.dataset.word;
            showVocabularyDetail(word);
            
            // Mark as found
            if (!foundWords.has(word)) {
                foundWords.add(word);
                updateVocabularyStats();
                saveVocabularyProgress(word);
            }
        });
    });
}

function updateVocabularySection(vocabulary) {
    const vocabularyGrid = document.getElementById('vocabularyGrid') || document.querySelector('.vocabulary-grid');
    if (!vocabularyGrid) return;
    
    vocabularyGrid.innerHTML = vocabulary.map(vocab => {
        const isFound = foundWords.has(vocab.word.toLowerCase());
        
        return `
            <div class="vocab-card ${isFound ? 'found' : ''}" data-word="${vocab.word.toLowerCase()}">
                <div class="vocab-card-header">
                    <span class="vocab-word">${vocab.word}</span>
                    ${isFound ? '<span class="found-badge"><i class="fas fa-check"></i></span>' : ''}
                </div>
                <div class="vocab-translation">${vocab.translation}</div>
                <div class="vocab-hint">Click to see in text</div>
                <div class="vocab-details" style="display: none;">
                    <div class="vocab-definition">${vocab.definition}</div>
                    <div class="vocab-example">"${vocab.example}"</div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click events to vocabulary cards
    document.querySelectorAll('.vocab-card').forEach(card => {
        card.addEventListener('click', function() {
            const word = this.dataset.word;
            
            // Toggle details
            const details = this.querySelector('.vocab-details');
            details.style.display = details.style.display === 'none' ? 'block' : 'none';
            
            // Highlight in text
            highlightWordInText(word);
            
            // Mark as found
            if (!foundWords.has(word)) {
                foundWords.add(word);
                this.classList.add('found');
                updateVocabularyStats();
                saveVocabularyProgress(word);
            }
        });
    });
    
    // Update stats
    updateVocabularyStats();
}

function updateVocabularyStats() {
    const totalWords = currentUnit.vocabulary?.length || 0;
    const foundCount = foundWords.size;
    const notFoundCount = totalWords - foundCount;
    
    const foundCountElement = document.getElementById('foundCount');
    const notFoundCountElement = document.getElementById('notFoundCount');
    
    if (foundCountElement) foundCountElement.textContent = foundCount;
    if (notFoundCountElement) notFoundCountElement.textContent = notFoundCount;
    
    // Update progress bar if exists
    const progressBar = document.querySelector('.vocab-progress-bar');
    if (progressBar && totalWords > 0) {
        const percent = Math.round((foundCount / totalWords) * 100);
        progressBar.style.width = `${percent}%`;
        
        const progressText = document.querySelector('.vocab-progress-text');
        if (progressText) {
            progressText.textContent = `${foundCount}/${totalWords} words found`;
        }
    }
}

function updateGrammarSection(grammar) {
    const grammarContent = document.getElementById('grammarContent') || document.querySelector('.grammar-content');
    if (!grammarContent || !grammar) return;
    
    grammarContent.innerHTML = `
        <div class="grammar-theme">
            <i class="fas fa-graduation-cap"></i>
            <h4>${grammar.theme}</h4>
        </div>
        <div class="grammar-description">
            <p>${grammar.description}</p>
        </div>
        <div class="grammar-examples">
            <h5>Examples from the text:</h5>
            <ul>
                ${grammar.examples.map(example => 
                    `<li><i class="fas fa-quote-left"></i> ${example}</li>`
                ).join('')}
            </ul>
        </div>
        <div class="grammar-practice">
            <button class="practice-btn" onclick="showGrammarPractice()">
                <i class="fas fa-pen"></i> Practice This Grammar
            </button>
        </div>
    `;
}

function updateExercisesSection(exercises) {
    const exercisesGrid = document.getElementById('exercisesGrid') || document.querySelector('.exercises-grid');
    if (!exercisesGrid) return;
    
    if (!exercises || exercises.length === 0) {
        exercisesGrid.innerHTML = `
            <div class="no-exercises">
                <i class="fas fa-clipboard-list"></i>
                <h4>No exercises available for this unit</h4>
                <p>Exercises will be added soon!</p>
            </div>
        `;
        return;
    }
    
    exercisesGrid.innerHTML = exercises.map((exercise, index) => {
        const userAnswer = userProgress.exerciseScores?.[`${currentBook.id}_${currentUnit.id}_${index}`];
        const isCorrect = userAnswer?.isCorrect;
        const isSubmitted = userAnswer?.submitted;
        
        return `
            <div class="exercise-card ${isSubmitted ? (isCorrect ? 'correct' : 'incorrect') : ''}">
                <div class="exercise-header">
                    <h4>${getExerciseTypeTitle(exercise.type)}</h4>
                    <span class="exercise-number">${index + 1}</span>
                </div>
                <div class="exercise-question">${exercise.question}</div>
                <div class="exercise-options">
                    ${exercise.options.map((option, optIndex) => `
                        <div class="option ${isSubmitted && optIndex === exercise.correct ? 'correct-answer' : ''} 
                                        ${isSubmitted && userAnswer?.selected === optIndex && optIndex !== exercise.correct ? 'incorrect-answer' : ''}"
                             onclick="selectOption(this, ${index}, ${optIndex})"
                             data-index="${optIndex}">
                            <span class="option-letter">${String.fromCharCode(65 + optIndex)}</span>
                            <span class="option-text">${option}</span>
                            ${isSubmitted && optIndex === exercise.correct ? 
                                '<i class="fas fa-check correct-icon"></i>' : ''}
                            ${isSubmitted && userAnswer?.selected === optIndex && optIndex !== exercise.correct ? 
                                '<i class="fas fa-times incorrect-icon"></i>' : ''}
                        </div>
                    `).join('')}
                </div>
                ${!isSubmitted ? `
                    <button class="check-btn" onclick="checkExercise(${index})">
                        <i class="fas fa-check"></i> Check Answer
                    </button>
                ` : `
                    <div class="exercise-feedback">
                        ${isCorrect ? 
                            '<span class="correct-feedback"><i class="fas fa-check-circle"></i> Correct! Well done!</span>' : 
                            '<span class="incorrect-feedback"><i class="fas fa-times-circle"></i> Incorrect. Try again!</span>'
                        }
                        <button class="retry-btn" onclick="resetExercise(${index})">
                            <i class="fas fa-redo"></i> Try Again
                        </button>
                    </div>
                `}
            </div>
        `;
    }).join('');
}

function getExerciseTypeTitle(type) {
    const titles = {
        'definition': '📝 Definition',
        'gap-filling': '🔤 Gap Filling',
        'english-uzbek': '🇬🇧 → 🇺🇿 Translation',
        'uzbek-english': '🇺🇿 → 🇬🇧 Translation',
        'grammar': '📚 Grammar Exercise'
    };
    return titles[type] || '📝 Exercise';
}

function initReadingFeatures() {
    // Read Aloud button
    const readAloudBtn = document.getElementById('readAloudBtn') || document.querySelector('[data-action="read-aloud"]');
    if (readAloudBtn) {
        readAloudBtn.addEventListener('click', toggleReadAloud);
    }
    
    // Skimming button
    const skimmingBtn = document.getElementById('skimmingBtn') || document.querySelector('[data-action="skimming"]');
    if (skimmingBtn) {
        skimmingBtn.addEventListener('click', toggleSkimming);
    }
    
    // Speed controls
    const readingSpeedControl = document.getElementById('readingSpeed');
    const skimmingSpeedControl = document.getElementById('skimmingSpeed');
    
    if (readingSpeedControl) {
        readingSpeedControl.addEventListener('input', function(e) {
            readingSpeed = parseFloat(e.target.value) / 100;
            const speedDisplay = document.querySelector('.reading-speed-display');
            if (speedDisplay) {
                speedDisplay.textContent = readingSpeed.toFixed(1) + 'x';
            }
            
            if (isReadingAloud && currentUtterance) {
                currentUtterance.rate = readingSpeed;
                speechSynthesis.cancel();
                speechSynthesis.speak(currentUtterance);
            }
        });
    }
    
    if (skimmingSpeedControl) {
        skimmingSpeedControl.addEventListener('input', function(e) {
            skimmingSpeed = 150 - parseInt(e.target.value);
            const speedDisplay = document.querySelector('.skimming-speed-display');
            if (speedDisplay) {
                const wpm = Math.round(60000 / skimmingSpeed);
                speedDisplay.textContent = `${wpm} wpm`;
            }
            
            if (isSkimming) {
                clearInterval(skimmingInterval);
                startSkimming();
            }
        });
    }
    
    // Initialize speed displays
    updateSpeedDisplays();
}

function toggleReadAloud() {
    const textContent = document.getElementById('textContent') || document.querySelector('.text-content');
    const button = document.getElementById('readAloudBtn') || document.querySelector('[data-action="read-aloud"]');
    
    if (!textContent || !speechSynthesis) {
        showToast('Text-to-speech is not supported in your browser', 'error');
        return;
    }
    
    if (isReadingAloud) {
        // Stop reading
        speechSynthesis.cancel();
        isReadingAloud = false;
        button.classList.remove('active');
        button.innerHTML = '<i class="fas fa-volume-up"></i> Read Aloud';
        showToast('Reading stopped', 'info');
    } else {
        // Start reading
        const text = textContent.textContent;
        currentUtterance = new SpeechSynthesisUtterance(text);
        
        // Configure voice
        currentUtterance.rate = readingSpeed;
        currentUtterance.pitch = 1;
        currentUtterance.volume = 1;
        currentUtterance.lang = 'en-US';
        
        // Try to get a good voice
        const voices = speechSynthesis.getVoices();
        const englishVoice = voices.find(voice => 
            voice.lang.startsWith('en') && voice.name.includes('Natural')) || 
            voices.find(voice => voice.lang.startsWith('en'));
            
        if (englishVoice) {
            currentUtterance.voice = englishVoice;
        }
        
        currentUtterance.onstart = function() {
            isReadingAloud = true;
            button.classList.add('active');
            button.innerHTML = '<i class="fas fa-stop"></i> Stop Reading';
            showToast('Reading started', 'success');
        };
        
        currentUtterance.onend = function() {
            isReadingAloud = false;
            button.classList.remove('active');
            button.innerHTML = '<i class="fas fa-volume-up"></i> Read Aloud';
        };
        
        currentUtterance.onerror = function(event) {
            console.error('Speech synthesis error:', event);
            isReadingAloud = false;
            button.classList.remove('active');
            button.innerHTML = '<i class="fas fa-volume-up"></i> Read Aloud';
            showToast('Error reading text', 'error');
        };
        
        speechSynthesis.speak(currentUtterance);
    }
}

function toggleSkimming() {
    const textContent = document.getElementById('textContent') || document.querySelector('.text-content');
    const button = document.getElementById('skimmingBtn') || document.querySelector('[data-action="skimming"]');
    
    if (!textContent) return;
    
    if (isSkimming) {
        // Stop skimming
        clearInterval(skimmingInterval);
        isSkimming = false;
        button.classList.remove('active');
        button.innerHTML = '<i class="fas fa-running"></i> Start Skimming';
        
        // Restore full text
        const paragraphs = currentUnit.text.split('\n\n');
        textContent.innerHTML = paragraphs.map(p => 
            `<p class="reading-paragraph">${p}</p>`
        ).join('');
        
        // Re-highlight vocabulary
        highlightVocabularyWords();
        
        showToast('Skimming stopped', 'info');
    } else {
        // Start skimming
        isSkimming = true;
        button.classList.add('active');
        button.innerHTML = '<i class="fas fa-stop"></i> Stop Skimming';
        
        startSkimming();
        showToast('Skimming started', 'success');
    }
}

function startSkimming() {
    const textContent = document.getElementById('textContent') || document.querySelector('.text-content');
    const fullText = currentUnit.text;
    let currentPosition = 0;
    
    // Clear existing interval
    if (skimmingInterval) {
        clearInterval(skimmingInterval);
    }
    
    skimmingInterval = setInterval(() => {
        if (currentPosition >= fullText.length || !isSkimming) {
            clearInterval(skimmingInterval);
            isSkimming = false;
            const button = document.getElementById('skimmingBtn') || document.querySelector('[data-action="skimming"]');
            if (button) {
                button.classList.remove('active');
                button.innerHTML = '<i class="fas fa-running"></i> Start Skimming';
            }
            return;
        }
        
        currentPosition++;
        const visibleText = fullText.substring(0, currentPosition);
        const hiddenText = fullText.substring(currentPosition);
        
        // Update text content with fading effect
        textContent.innerHTML = `
            <div class="visible-text">${visibleText}</div>
            <div class="hidden-text">${hiddenText}</div>
        `;
        
    }, skimmingSpeed);
}

function updateSpeedDisplays() {
    const readingSpeedDisplay = document.querySelector('.reading-speed-display');
    const skimmingSpeedDisplay = document.querySelector('.skimming-speed-display');
    
    if (readingSpeedDisplay) {
        readingSpeedDisplay.textContent = readingSpeed.toFixed(1) + 'x';
    }
    
    if (skimmingSpeedDisplay) {
        const wpm = Math.round(60000 / skimmingSpeed);
        skimmingSpeedDisplay.textContent = `${wpm} wpm`;
    }
}

function showVocabularyDetail(word) {
    const vocab = currentUnit.vocabulary.find(v => v.word.toLowerCase() === word.toLowerCase());
    if (!vocab) return;
    
    // Create or show popup
    let popup = document.getElementById('vocabPopup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'vocabPopup';
        popup.className = 'vocab-popup';
        popup.innerHTML = `
            <div class="popup-overlay" onclick="closeVocabPopup()"></div>
            <div class="popup-content">
                <button class="close-popup" onclick="closeVocabPopup()">
                    <i class="fas fa-times"></i>
                </button>
                <div class="popup-body"></div>
            </div>
        `;
        document.body.appendChild(popup);
    }
    
    // Update popup content
    const popupBody = popup.querySelector('.popup-body');
    popupBody.innerHTML = `
        <div class="vocab-popup-header">
            <h3>${vocab.word}</h3>
            <span class="vocab-translation">${vocab.translation}</span>
        </div>
        <div class="vocab-details">
            <div class="detail-section">
                <h4><i class="fas fa-book"></i> Definition</h4>
                <p>${vocab.definition}</p>
            </div>
            <div class="detail-section">
                <h4><i class="fas fa-quote-left"></i> Example</h4>
                <p class="example">"${vocab.example}"</p>
            </div>
            <div class="detail-section">
                <h4><i class="fas fa-lightbulb"></i> Usage Tip</h4>
                <p>This word appears in the text above. Try to find it and understand its context.</p>
            </div>
        </div>
        <div class="popup-actions">
            <button class="btn-secondary" onclick="closeVocabPopup()">
                <i class="fas fa-times"></i> Close
            </button>
            <button class="btn-primary" onclick="markAsMastered('${word}')">
                <i class="fas fa-check-circle"></i> Mark as Mastered
            </button>
        </div>
    `;
    
    popup.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Highlight word in text
    highlightWordInText(word);
}

function highlightWordInText(word) {
    // Scroll to and highlight the word in the text
    const wordElement = document.querySelector(`.vocab-highlight[data-word="${word}"]`);
    if (wordElement) {
        // Scroll to word
        wordElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
        
        // Add highlight animation
        wordElement.classList.add('highlighted');
        setTimeout(() => {
            wordElement.classList.remove('highlighted');
        }, 2000);
    }
}

function closeVocabPopup() {
    const popup = document.getElementById('vocabPopup');
    if (popup) {
        popup.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function initExercises() {
    // Initialize exercise event listeners
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('option')) {
            const option = e.target;
            const exerciseCard = option.closest('.exercise-card');
            if (exerciseCard && !exerciseCard.classList.contains('submitted')) {
                // Clear previous selection in this exercise
                exerciseCard.querySelectorAll('.option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                
                // Select this option
                option.classList.add('selected');
            }
        }
    });
}

function selectOption(element, exerciseIndex, optionIndex) {
    const exerciseCard = element.closest('.exercise-card');
    if (exerciseCard.classList.contains('submitted')) return;
    
    // Clear other selections in this exercise
    exerciseCard.querySelectorAll('.option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    // Select this option
    element.classList.add('selected');
}

function checkExercise(exerciseIndex) {
    const exerciseCard = document.querySelectorAll('.exercise-card')[exerciseIndex];
    if (!exerciseCard || exerciseCard.classList.contains('submitted')) return;
    
    const selectedOption = exerciseCard.querySelector('.option.selected');
    if (!selectedOption) {
        showToast('Please select an answer first!', 'warning');
        return;
    }
    
    const selectedIndex = parseInt(selectedOption.dataset.index);
    const exercise = currentUnit.exercises[exerciseIndex];
    const isCorrect = selectedIndex === exercise.correct;
    
    // Mark as submitted
    exerciseCard.classList.add('submitted');
    
    // Show correct/incorrect indicators
    exerciseCard.querySelectorAll('.option').forEach((option, idx) => {
        if (idx === exercise.correct) {
            option.classList.add('correct-answer');
        }
        if (idx === selectedIndex && idx !== exercise.correct) {
            option.classList.add('incorrect-answer');
        }
    });
    
    // Save result
    saveExerciseResult(exerciseIndex, selectedIndex, isCorrect);
    
    // Show feedback
    if (isCorrect) {
        showToast('Correct! Well done! 🎉', 'success');
    } else {
        showToast('Incorrect. Try again! 💪', 'error');
    }
    
    // Update exercise card with feedback
    const feedbackHTML = isCorrect ? 
        `<div class="exercise-feedback correct">
            <i class="fas fa-check-circle"></i>
            <span>Excellent! You got it right!</span>
        </div>` :
        `<div class="exercise-feedback incorrect">
            <i class="fas fa-times-circle"></i>
            <span>Not quite right. The correct answer is highlighted.</span>
        </div>`;
    
    const checkBtn = exerciseCard.querySelector('.check-btn');
    if (checkBtn) {
        checkBtn.outerHTML = feedbackHTML;
    }
}

function resetExercise(exerciseIndex) {
    const exerciseCard = document.querySelectorAll('.exercise-card')[exerciseIndex];
    if (!exerciseCard) return;
    
    // Remove submitted state
    exerciseCard.classList.remove('submitted', 'correct', 'incorrect');
    
    // Clear selections and indicators
    exerciseCard.querySelectorAll('.option').forEach(option => {
        option.classList.remove('selected', 'correct-answer', 'incorrect-answer');
    });
    
    // Restore check button
    const feedback = exerciseCard.querySelector('.exercise-feedback');
    if (feedback) {
        feedback.outerHTML = `
            <button class="check-btn" onclick="checkExercise(${exerciseIndex})">
                <i class="fas fa-check"></i> Check Answer
            </button>
        `;
    }
    
    // Clear saved result
    if (userProgress.exerciseScores) {
        delete userProgress.exerciseScores[`${currentBook.id}_${currentUnit.id}_${exerciseIndex}`];
        localStorage.setItem(`progress_${currentUser.id}`, JSON.stringify(userProgress));
    }
}

function saveExerciseResult(exerciseIndex, selectedIndex, isCorrect) {
    if (!userProgress.exerciseScores) {
        userProgress.exerciseScores = {};
    }
    
    const exerciseKey = `${currentBook.id}_${currentUnit.id}_${exerciseIndex}`;
    userProgress.exerciseScores[exerciseKey] = {
        selected: selectedIndex,
        isCorrect: isCorrect,
        submitted: true,
        timestamp: new Date().toISOString()
    };
    
    localStorage.setItem(`progress_${currentUser.id}`, JSON.stringify(userProgress));
    
    // Update overall progress
    updateOverallProgress();
}

function saveVocabularyProgress(word) {
    if (!userProgress.vocabularyFound) {
        userProgress.vocabularyFound = {};
    }
    
    const vocabKey = `${currentBook.id}_${currentUnit.id}_${word}`;
    userProgress.vocabularyFound[vocabKey] = {
        found: true,
        timestamp: new Date().toISOString()
    };
    
    localStorage.setItem(`progress_${currentUser.id}`, JSON.stringify(userProgress));
}

function loadUserProgress(bookId, unitId) {
    // Load found vocabulary
    if (userProgress.vocabularyFound) {
        Object.keys(userProgress.vocabularyFound).forEach(key => {
            if (key.startsWith(`${bookId}_${unitId}_`)) {
                const word = key.split('_').pop();
                foundWords.add(word);
            }
        });
    }
    
    // Update vocabulary stats
    updateVocabularyStats();
}

function updateOverallProgress() {
    // Calculate completion percentage
    const totalExercises = currentUnit.exercises?.length || 0;
    const completedExercises = Object.keys(userProgress.exerciseScores || {}).filter(key => 
        key.startsWith(`${currentBook.id}_${currentUnit.id}_`)
    ).length;
    
    const totalVocabulary = currentUnit.vocabulary?.length || 0;
    const foundVocabulary = foundWords.size;
    
    const exerciseProgress = totalExercises > 0 ? (completedExercises / totalExercises) * 50 : 0;
    const vocabularyProgress = totalVocabulary > 0 ? (foundVocabulary / totalVocabulary) * 50 : 0;
    const totalProgress = exerciseProgress + vocabularyProgress;
    
    // Update progress display if exists
    const progressDisplay = document.querySelector('.overall-progress');
    if (progressDisplay) {
        progressDisplay.innerHTML = `
            <div class="progress-info">
                <span class="progress-text">Overall Progress: ${Math.round(totalProgress)}%</span>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${totalProgress}%"></div>
                </div>
                <div class="progress-details">
                    <span><i class="fas fa-check-circle"></i> ${completedExercises}/${totalExercises} exercises</span>
                    <span><i class="fas fa-book"></i> ${foundVocabulary}/${totalVocabulary} vocabulary</span>
                </div>
            </div>
        `;
    }
    
    // Mark unit as completed if progress is good
    if (totalProgress >= 70) {
        markUnitAsCompleted();
    }
}

function markUnitAsCompleted() {
    if (!userProgress.completedUnits) {
        userProgress.completedUnits = [];
    }
    
    const unitKey = `${currentBook.id}_${currentUnit.id}`;
    if (!userProgress.completedUnits.includes(unitKey)) {
        userProgress.completedUnits.push(unitKey);
        localStorage.setItem(`progress_${currentUser.id}`, JSON.stringify(userProgress));
        
        showToast(`Congratulations! You've completed Unit ${currentUnit.id}! 🎉`, 'success');
        
        // Show celebration animation
        showCelebration();
    }
}

function showCelebration() {
    const celebration = document.createElement('div');
    celebration.className = 'celebration';
    celebration.innerHTML = `
        <div class="confetti"></div>
        <div class="celebration-content">
            <h3><i class="fas fa-trophy"></i> Unit Completed!</h3>
            <p>Great job! You've successfully completed this unit.</p>
            <button class="btn-primary" onclick="this.parentElement.parentElement.remove()">
                Continue Learning
            </button>
        </div>
    `;
    
    document.body.appendChild(celebration);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (celebration.parentNode) {
            celebration.remove();
        }
    }, 5000);
}

function setupUnitPageEvents() {
    // Navigation buttons
    const prevBtn = document.querySelector('.prev-unit');
    const nextBtn = document.querySelector('.next-unit');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', navigateToPrevUnit);
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', navigateToNextUnit);
    }
    
    // Text selection for vocabulary
    document.addEventListener('mouseup', function() {
        const selection = window.getSelection();
        if (selection.toString().trim().length > 0) {
            showSelectionMenu(selection);
        }
    });
    
    // Close popups on ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeVocabPopup();
        }
    });
}

function navigateToPrevUnit() {
    // Implement navigation to previous unit
    showToast('Previous unit navigation coming soon!', 'info');
}

function navigateToNextUnit() {
    // Implement navigation to next unit
    showToast('Next unit navigation coming soon!', 'info');
}

function showSelectionMenu(selection) {
    const selectedText = selection.toString().trim();
    if (selectedText.length < 2 || selectedText.length > 30) return;
    
    // Check if selection contains vocabulary words
    const vocabWords = currentUnit.vocabulary || [];
    const isVocabulary = vocabWords.some(vocab => 
        selectedText.toLowerCase().includes(vocab.word.toLowerCase())
    );
    
    if (isVocabulary) {
        // Show custom context menu
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        const menu = document.createElement('div');
        menu.className = 'selection-menu';
        menu.style.cssText = `
            position: fixed;
            top: ${rect.bottom + window.scrollY}px;
            left: ${rect.left + window.scrollX}px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
        `;
        
        menu.innerHTML = `
            <div class="menu-item" onclick="lookupVocabulary('${selectedText}')">
                <i class="fas fa-book"></i> Look up vocabulary
            </div>
            <div class="menu-item" onclick="translateText('${selectedText}')">
                <i class="fas fa-language"></i> Translate
            </div>
        `;
        
        document.body.appendChild(menu);
        
        // Remove menu when clicking elsewhere
        setTimeout(() => {
            document.addEventListener('click', function removeMenu() {
                if (menu.parentNode) {
                    menu.remove();
                }
                document.removeEventListener('click', removeMenu);
            });
        }, 100);
    }
}

function lookupVocabulary(text) {
    const vocab = currentUnit.vocabulary.find(v => 
        text.toLowerCase().includes(v.word.toLowerCase())
    );
    
    if (vocab) {
        showVocabularyDetail(vocab.word);
    } else {
        showToast('This word is not in the vocabulary list', 'info');
    }
}

function translateText(text) {
    // Simple translation - in a real app, this would use a translation API
    showToast(`Translation for "${text}" would appear here`, 'info');
}

function markAsMastered(word) {
    const vocab = currentUnit.vocabulary.find(v => v.word.toLowerCase() === word.toLowerCase());
    if (vocab) {
        // Save to mastered vocabulary
        if (!userProgress.masteredVocabulary) {
            userProgress.masteredVocabulary = [];
        }
        
        const masteryKey = `${currentBook.id}_${word}`;
        if (!userProgress.masteredVocabulary.includes(masteryKey)) {
            userProgress.masteredVocabulary.push(masteryKey);
            localStorage.setItem(`progress_${currentUser.id}`, JSON.stringify(userProgress));
            
            showToast(`${vocab.word} marked as mastered! ✨`, 'success');
            closeVocabPopup();
        }
    }
}

function showGrammarPractice() {
    const grammar = currentUnit.grammar;
    if (!grammar) return;
    
    // Create grammar practice modal
    const modal = document.createElement('div');
    modal.className = 'grammar-practice-modal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <button class="close-modal" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
            <h3><i class="fas fa-graduation-cap"></i> ${grammar.theme} Practice</h3>
            <div class="practice-exercises">
                <p>Practice making sentences using this grammar pattern:</p>
                <div class="sentence-builder">
                    <input type="text" id="sentenceInput" placeholder="Write a sentence using ${grammar.theme}...">
                    <button class="btn-primary" onclick="checkGrammarSentence()">
                        <i class="fas fa-check"></i> Check Sentence
                    </button>
                </div>
                <div class="practice-examples">
                    <h4>Example Sentences:</h4>
                    ${grammar.examples.map(example => 
                        `<div class="example-sentence">"${example}"</div>`
                    ).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function checkGrammarSentence() {
    const input = document.getElementById('sentenceInput');
    if (input && input.value.trim()) {
        // Simple check - in a real app, this would be more sophisticated
        showToast('Good attempt! Keep practicing!', 'success');
        input.value = '';
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDateTime(date) {
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function countWords(text) {
    return text.trim().split(/\s+/).length;
}

function showToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type] || 'fa-info-circle'}"></i>
        <span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(toast);
    
    // Show toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }
    }, 5000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function logout() {
    // Clear user session
    localStorage.removeItem('readingUser');
    
    // Redirect to login
    window.location.href = 'index.html';
}

// ============================================
// INITIALIZE SPEECH SYNTHESIS
// ============================================

// Load voices when available
if (speechSynthesis) {
    speechSynthesis.onvoiceschanged = function() {
        console.log('Voices loaded:', speechSynthesis.getVoices().length);
    };
}

// Add CSS for dynamic elements
const dynamicStyles = document.createElement('style');
dynamicStyles.textContent = `
    /* Toast styles */
    .toast {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        color: #333;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 9999;
        transform: translateX(150%);
        transition: transform 0.3s ease;
        max-width: 400px;
    }
    
    .toast.show {
        transform: translateX(0);
    }
    
    .toast.success {
        border-left: 4px solid #10b981;
    }
    
    .toast.error {
        border-left: 4px solid #ef4444;
    }
    
    .toast.warning {
        border-left: 4px solid #f59e0b;
    }
    
    .toast.info {
        border-left: 4px solid #3b82f6;
    }
    
    .toast-close {
        background: none;
        border: none;
        color: #666;
        cursor: pointer;
        padding: 0;
        margin-left: auto;
    }
    
    /* Vocabulary highlight animation */
    .vocab-highlight.highlighted {
        background: linear-gradient(120deg, #a5b4fc, #818cf8);
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        animation: pulse 2s ease-in-out;
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
    
    /* Celebration animation */
    .celebration {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    }
    
    .celebration-content {
        background: white;
        padding: 40px;
        border-radius: 20px;
        text-align: center;
        max-width: 500px;
        animation: popIn 0.5s ease;
    }
    
    @keyframes popIn {
        from { transform: scale(0.8); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
    }
    
    /* Confetti animation */
    .confetti {
        position: absolute;
        width: 100%;
        height: 100%;
        pointer-events: none;
    }
    
    .confetti:before {
        content: '🎉';
        position: absolute;
        font-size: 24px;
        animation: confettiFall 3s linear infinite;
    }
    
    @keyframes confettiFall {
        0% { transform: translateY(-100px) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
    }
    
    /* Selection menu */
    .selection-menu {
        animation: slideDown 0.2s ease;
    }
    
    .menu-item {
        padding: 10px 15px;
        cursor: pointer;
        border-radius: 4px;
        transition: background 0.2s;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .menu-item:hover {
        background: #f3f4f6;
    }
    
    @keyframes slideDown {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    /* Error state */
    .error-state {
        text-align: center;
        padding: 40px;
        color: #666;
    }
    
    .error-state i {
        font-size: 48px;
        color: #ef4444;
        margin-bottom: 20px;
    }
    
    /* Modal styles */
    .grammar-practice-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }
    
    .modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
    }
    
    .modal-content {
        position: relative;
        background: white;
        padding: 30px;
        border-radius: 12px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
    }
    
    .close-modal {
        position: absolute;
        top: 15px;
        right: 15px;
        background: none;
        border: none;
        font-size: 1.2rem;
        color: #666;
        cursor: pointer;
    }
    
    /* Responsive improvements */
    @media (max-width: 768px) {
        .toast {
            left: 20px;
            right: 20px;
            max-width: none;
        }
        
        .celebration-content {
            margin: 20px;
            padding: 30px 20px;
        }
    }
`;

document.head.appendChild(dynamicStyles);
