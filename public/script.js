// DOM Elements
let currentUser = null;
let currentBook = null;
let currentUnit = null;
let isReadingAloud = false;
let isSkimming = false;
let speechSynthesis = null;
let skimmingInterval = null;
let skimmingSpeed = 50; // ms per character
let readingSpeed = 1.0; // Speech rate

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    const savedUser = localStorage.getItem('readingPlatformUser');
    const currentPath = window.location.pathname;
    
    if (savedUser && currentPath.includes('index.html')) {
        // Redirect to books page if already logged in
        window.location.href = 'books.html';
        return;
    }
    
    if (!savedUser && !currentPath.includes('index.html')) {
        // Redirect to login if not logged in
        window.location.href = 'index.html';
        return;
    }
    
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
    }
    
    // Initialize based on current page
    if (currentPath.includes('index.html')) {
        initLoginPage();
    } else if (currentPath.includes('books.html')) {
        initBooksPage();
    } else if (currentPath.includes('unit.html')) {
        initUnitPage();
    }
});

// Login Page Functions
function initLoginPage() {
    const loginForm = document.getElementById('loginForm');
    const lastLoginField = document.getElementById('lastLogin');
    
    // Check for previous login
    const lastUser = localStorage.getItem('lastUserLogin');
    if (lastUser) {
        lastLoginField.value = new Date(lastUser).toLocaleString();
    }
    
    // Set current time as placeholder
    const now = new Date();
    lastLoginField.placeholder = now.toLocaleString();
    
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const name = document.getElementById('name').value;
        const surname = document.getElementById('surname').value;
        const group = document.getElementById('group').value;
        
        // Save user data
        currentUser = {
            name,
            surname,
            group,
            loginTime: new Date().toISOString(),
            progress: JSON.parse(localStorage.getItem(`progress_${name}_${surname}`)) || {}
        };
        
        localStorage.setItem('readingPlatformUser', JSON.stringify(currentUser));
        localStorage.setItem('lastUserLogin', new Date().toISOString());
        
        // Show loading animation
        const button = loginForm.querySelector('button');
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entering...';
        button.disabled = true;
        
        // Redirect after delay
        setTimeout(() => {
            window.location.href = 'books.html';
        }, 1500);
    });
}

// Books Page Functions
function initBooksPage() {
    displayUserInfo();
    loadBooks();
    
    // Add logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('readingPlatformUser');
            window.location.href = 'index.html';
        });
    }
}

function displayUserInfo() {
    const userInfoElement = document.querySelector('.user-info');
    if (userInfoElement && currentUser) {
        userInfoElement.innerHTML = `
            <div class="user-details">
                <div class="name">${currentUser.name} ${currentUser.surname}</div>
                <div class="group">${currentUser.group}</div>
            </div>
            <button id="logoutBtn" class="control-button">
                <i class="fas fa-sign-out-alt"></i> Logout
            </button>
        `;
    }
}

async function loadBooks() {
    try {
        const response = await fetch('api/books.json');
        const data = await response.json();
        currentBook = data.books[0]; // Get the first book
        
        const booksGrid = document.querySelector('.books-grid');
        if (booksGrid) {
            // Clear loading state
            booksGrid.innerHTML = '';
            
            // Create book cards
            data.books.forEach((book, index) => {
                const bookCard = document.createElement('div');
                bookCard.className = `book-card ${index === 0 ? 'active' : ''}`;
                bookCard.innerHTML = `
                    <div class="book-cover">
                        <i class="fas fa-book-open"></i>
                    </div>
                    <div class="book-info">
                        <h3>${book.title}</h3>
                        <p>${book.description}</p>
                        <span class="book-status ${index === 0 ? 'status-available' : 'status-soon'}">
                            ${index === 0 ? 'Available Now' : 'Coming Soon'}
                        </span>
                    </div>
                `;
                
                if (index === 0) {
                    bookCard.addEventListener('click', function() {
                        window.location.href = 'book.html';
                    });
                } else {
                    bookCard.style.opacity = '0.6';
                    bookCard.style.cursor = 'not-allowed';
                }
                
                booksGrid.appendChild(bookCard);
            });
        }
    } catch (error) {
        console.error('Error loading books:', error);
        showNotification('Error loading books. Please try again.', 'error');
    }
}

// Unit Page Functions
async function initUnitPage() {
    displayUserInfo();
    await loadUnitContent();
    initReadingFeatures();
    initVocabularySection();
    initGrammarSection();
    initExercisesSection();
}

async function loadUnitContent() {
    try {
        const response = await fetch('api/books.json');
        const data = await response.json();
        currentBook = data.books[0];
        currentUnit = currentBook.units[0]; // Get first unit
        
        // Update page title and header
        document.title = `${currentUnit.title} - ${currentBook.title}`;
        
        const unitHeader = document.querySelector('.unit-header');
        if (unitHeader) {
            unitHeader.innerHTML = `
                <h1>${currentBook.title}</h1>
                <h2>Unit ${currentUnit.id}: ${currentUnit.title}</h2>
            `;
        }
        
        // Load text content
        const textContent = document.querySelector('.text-content');
        if (textContent) {
            // Format the text with paragraphs
            const paragraphs = currentUnit.text.split('\n\n');
            textContent.innerHTML = paragraphs.map(p => `<p>${p}</p>`).join('');
        }
        
        // Add click event for vocabulary words
        highlightVocabularyWords();
        
    } catch (error) {
        console.error('Error loading unit content:', error);
        showNotification('Error loading content. Please try again.', 'error');
    }
}

function highlightVocabularyWords() {
    const textContent = document.querySelector('.text-content');
    if (!textContent || !currentUnit || !currentUnit.vocabulary) return;
    
    const words = currentUnit.vocabulary.map(v => v.word.toLowerCase());
    
    // Split text into words and spans
    const originalHTML = textContent.innerHTML;
    let newHTML = originalHTML;
    
    words.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        newHTML = newHTML.replace(regex, 
            `<span class="vocab-word" data-word="${word.toLowerCase()}">$&</span>`);
    });
    
    textContent.innerHTML = newHTML;
    
    // Add click events to vocabulary words
    document.querySelectorAll('.vocab-word').forEach(span => {
        span.addEventListener('click', function() {
            const word = this.dataset.word;
            showVocabularyPopup(word);
        });
    });
}

function showVocabularyPopup(word) {
    const vocab = currentUnit.vocabulary.find(v => v.word.toLowerCase() === word.toLowerCase());
    if (!vocab) return;
    
    // Create and show popup
    const popup = document.createElement('div');
    popup.className = 'vocab-popup';
    popup.innerHTML = `
        <div class="popup-content">
            <div class="popup-header">
                <h3>${vocab.word}</h3>
                <button class="close-popup">&times;</button>
            </div>
            <div class="popup-body">
                <p><strong>Translation:</strong> ${vocab.translation}</p>
                <p><strong>Definition:</strong> ${vocab.definition}</p>
                <p><strong>Example:</strong> ${vocab.example}</p>
            </div>
        </div>
    `;
    
    popup.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
    `;
    
    popup.querySelector('.popup-content').style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 12px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(popup);
    
    // Close popup
    popup.querySelector('.close-popup').addEventListener('click', () => {
        document.body.removeChild(popup);
    });
    
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            document.body.removeChild(popup);
        }
    });
}

function initReadingFeatures() {
    // Initialize speech synthesis
    if ('speechSynthesis' in window) {
        speechSynthesis = window.speechSynthesis;
    }
    
    // Read Aloud functionality
    const readAloudBtn = document.querySelector('[data-action="read-aloud"]');
    if (readAloudBtn) {
        readAloudBtn.addEventListener('click', toggleReadAloud);
    }
    
    // Skimming functionality
    const skimmingBtn = document.querySelector('[data-action="skimming"]');
    if (skimmingBtn) {
        skimmingBtn.addEventListener('click', toggleSkimming);
    }
    
    // Speed controls
    const readingSpeedControl = document.getElementById('readingSpeed');
    const skimmingSpeedControl = document.getElementById('skimmingSpeed');
    
    if (readingSpeedControl) {
        readingSpeedControl.addEventListener('input', function(e) {
            readingSpeed = parseFloat(e.target.value);
            document.querySelector('.reading-speed-value').textContent = readingSpeed.toFixed(1);
        });
    }
    
    if (skimmingSpeedControl) {
        skimmingSpeedControl.addEventListener('input', function(e) {
            skimmingSpeed = 150 - parseInt(e.target.value); // Inverse for intuitive control
            document.querySelector('.skimming-speed-value').textContent = e.target.value;
        });
    }
}

function toggleReadAloud() {
    const button = document.querySelector('[data-action="read-aloud"]');
    const textContent = document.querySelector('.text-content');
    
    if (!speechSynthesis || !textContent) return;
    
    if (isReadingAloud) {
        // Stop reading
        speechSynthesis.cancel();
        isReadingAloud = false;
        button.classList.remove('active');
        button.innerHTML = '<i class="fas fa-volume-up"></i> Read Aloud';
    } else {
        // Start reading
        const text = textContent.textContent;
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Configure voice
        utterance.rate = readingSpeed;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        // Try to get a natural voice
        const voices = speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice => 
            voice.lang.startsWith('en') && voice.name.includes('Natural'));
        
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }
        
        utterance.onend = function() {
            isReadingAloud = false;
            button.classList.remove('active');
            button.innerHTML = '<i class="fas fa-volume-up"></i> Read Aloud';
        };
        
        speechSynthesis.speak(utterance);
        isReadingAloud = true;
        button.classList.add('active');
        button.innerHTML = '<i class="fas fa-stop"></i> Stop Reading';
    }
}

function toggleSkimming() {
    const button = document.querySelector('[data-action="skimming"]');
    const textContent = document.querySelector('.text-content');
    
    if (!textContent) return;
    
    if (isSkimming) {
        // Stop skimming
        clearInterval(skimmingInterval);
        textContent.classList.remove('skimming');
        isSkimming = false;
        button.classList.remove('active');
        button.innerHTML = '<i class="fas fa-running"></i> Start Skimming';
        
        // Restore text
        textContent.style.opacity = '1';
    } else {
        // Start skimming
        const text = textContent.textContent;
        let position = 0;
        
        textContent.classList.add('skimming');
        isSkimming = true;
        button.classList.add('active');
        button.innerHTML = '<i class="fas fa-stop"></i> Stop Skimming';
        
        skimmingInterval = setInterval(() => {
            if (position >= text.length) {
                clearInterval(skimmingInterval);
                isSkimming = false;
                button.classList.remove('active');
                button.innerHTML = '<i class="fas fa-running"></i> Start Skimming';
                textContent.classList.remove('skimming');
                return;
            }
            
            position++;
            const visibleText = text.substring(0, position);
            const hiddenText = text.substring(position);
            
            textContent.innerHTML = `
                <span style="color: #1f2937;">${visibleText}</span>
                <span style="color: transparent;">${hiddenText}</span>
            `;
            
        }, skimmingSpeed);
    }
}

function initVocabularySection() {
    if (!currentUnit || !currentUnit.vocabulary) return;
    
    const vocabularyGrid = document.querySelector('.vocabulary-grid');
    if (!vocabularyGrid) return;
    
    // Clear existing content
    vocabularyGrid.innerHTML = '';
    
    // Create vocabulary cards
    currentUnit.vocabulary.forEach((vocab, index) => {
        const card = document.createElement('div');
        card.className = 'vocab-card';
        card.dataset.word = vocab.word.toLowerCase();
        card.innerHTML = `
            <div class="word">${vocab.word}</div>
            <div class="translation">${vocab.translation}</div>
            <div class="definition">${vocab.definition}</div>
            <div class="example">"${vocab.example}"</div>
            <div class="hint">Click to reveal in text</div>
        `;
        
        card.addEventListener('click', function() {
            // Highlight word in text
            const wordElement = document.querySelector(`.vocab-word[data-word="${vocab.word.toLowerCase()}"]`);
            if (wordElement) {
                wordElement.style.backgroundColor = '#4ade80';
                wordElement.style.color = 'white';
                wordElement.style.padding = '2px 4px';
                wordElement.style.borderRadius = '3px';
                wordElement.style.fontWeight = 'bold';
                
                // Scroll to word
                wordElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Mark as found
                this.classList.add('found');
                
                // Update stats
                updateVocabularyStats();
            } else {
                this.classList.add('not-found');
                updateVocabularyStats();
            }
        });
        
        vocabularyGrid.appendChild(card);
    });
    
    // Initialize stats
    updateVocabularyStats();
}

function updateVocabularyStats() {
    const foundCards = document.querySelectorAll('.vocab-card.found').length;
    const notFoundCards = document.querySelectorAll('.vocab-card.not-found').length;
    const totalCards = currentUnit.vocabulary.length;
    
    const greatStat = document.querySelector('.stat.great');
    const oopsStat = document.querySelector('.stat.oops');
    
    if (greatStat) {
        greatStat.innerHTML = `<i class="fas fa-check-circle"></i> Great: ${foundCards}`;
    }
    
    if (oopsStat) {
        oopsStat.innerHTML = `<i class="fas fa-times-circle"></i> Oops: ${notFoundCards}`;
    }
}

function initGrammarSection() {
    if (!currentUnit || !currentUnit.grammar) return;
    
    const grammarContent = document.querySelector('.grammar-content');
    if (!grammarContent) return;
    
    const grammar = currentUnit.grammar;
    
    grammarContent.innerHTML = `
        <div class="grammar-theme">${grammar.theme}</div>
        <div class="grammar-description">${grammar.description}</div>
        <ul class="grammar-examples">
            ${grammar.examples.map(example => `<li>${example}</li>`).join('')}
        </ul>
    `;
}

function initExercisesSection() {
    // This would normally come from the API
    const exercises = [
        {
            type: 'definition',
            question: 'What does "dozen" mean?',
            options: ['Ten', 'Twelve', 'Twenty', 'Hundred'],
            correct: 1
        },
        {
            type: 'gap-filling',
            question: 'Complete the sentence: The zipper ______ in 1893.',
            options: ['invented', 'was invented', 'invents', 'is inventing'],
            correct: 1
        },
        {
            type: 'english-uzbek',
            question: 'What is the Uzbek translation of "flexible"?',
            options: ['qattiq', 'egiluvchan', 'kuchsiz', 'yumshoq'],
            correct: 1
        },
        {
            type: 'uzbek-english',
            question: '"Mahkamlangan" in English is:',
            options: ['loose', 'broken', 'fastened', 'flexible'],
            correct: 2
        },
        {
            type: 'grammar',
            question: 'Which sentence is in Simple Past Tense?',
            options: [
                'The zipper is wonderful.',
                'People wear high shoes.',
                'Whitcomb invented the zipper.',
                'Zippers come in many colors.'
            ],
            correct: 2
        }
    ];
    
    const exerciseGrid = document.querySelector('.exercise-grid');
    if (!exerciseGrid) return;
    
    exerciseGrid.innerHTML = exercises.map((exercise, index) => `
        <div class="exercise-card">
            <h4>
                <i class="fas fa-${getExerciseIcon(exercise.type)}"></i>
                ${getExerciseTitle(exercise.type)}
            </h4>
            <div class="question">${exercise.question}</div>
            <div class="options" data-exercise="${index}">
                ${exercise.options.map((option, i) => `
                    <div class="option" data-index="${i}">${option}</div>
                `).join('')}
            </div>
            <button class="submit-btn" onclick="checkExercise(${index})">Check Answer</button>
        </div>
    `).join('');
    
    // Add click events to options
    document.querySelectorAll('.options .option').forEach(option => {
        option.addEventListener('click', function() {
            const parent = this.parentElement;
            parent.querySelectorAll('.option').forEach(opt => {
                opt.classList.remove('selected');
            });
            this.classList.add('selected');
        });
    });
}

function getExerciseIcon(type) {
    const icons = {
        'definition': 'book',
        'gap-filling': 'fill-drip',
        'english-uzbek': 'language',
        'uzbek-english': 'exchange-alt',
        'grammar': 'pen-alt'
    };
    return icons[type] || 'question';
}

function getExerciseTitle(type) {
    const titles = {
        'definition': 'Definition',
        'gap-filling': 'Gap Filling',
        'english-uzbek': 'English → Uzbek',
        'uzbek-english': 'Uzbek → English',
        'grammar': 'Grammar Exercise'
    };
    return titles[type] || 'Exercise';
}

function checkExercise(exerciseIndex) {
    const exerciseCard = document.querySelectorAll('.exercise-card')[exerciseIndex];
    const options = exerciseCard.querySelectorAll('.option');
    const selected = exerciseCard.querySelector('.option.selected');
    
    if (!selected) {
        showNotification('Please select an answer first!', 'warning');
        return;
    }
    
    // In a real app, this would come from the API
    const correctAnswer = [1, 1, 1, 2, 2][exerciseIndex]; // Mock correct answers
    
    options.forEach(option => {
        const index = parseInt(option.dataset.index);
        option.classList.remove('correct', 'incorrect');
        
        if (index === correctAnswer) {
            option.classList.add('correct');
        } else if (option === selected && index !== correctAnswer) {
            option.classList.add('incorrect');
        }
    });
    
    if (parseInt(selected.dataset.index) === correctAnswer) {
        showNotification('Correct answer! Well done!', 'success');
    } else {
        showNotification('Try again! You can do it!', 'error');
    }
}

// Utility Functions
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 
                           type === 'error' ? 'exclamation-circle' : 
                           type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : 
                     type === 'error' ? '#ef4444' : 
                     type === 'warning' ? '#f59e0b' : '#3b82f6'};
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 3000;
        animation: slideIn 0.3s ease;
        max-width: 400px;
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
    
    // Add CSS animations
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Navigation functions
function goBack() {
    window.history.back();
}

// Initialize when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function init() {
    // Add any additional initialization code here
}
