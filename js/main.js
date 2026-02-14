document.addEventListener("DOMContentLoaded", () => {
    
    // 1. ANIMACIÓN SCROLL (OBSERVER)
    const sections = document.querySelectorAll('.protocol-section');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
            }
        });
    }, { threshold: 0.2 });
    sections.forEach(section => observer.observe(section));

    // 2. EFECTO DECODI (TEXT SCRAMBLE)
    const scrambleChars = '!<>-_\\/[]{}—=+*^?#';
    const scrambleColors = ['#00ffff', '#9e00ff', '#f5f5f5'];
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const getRandomChar = () => scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
    const getRandomColor = () => scrambleColors[Math.floor(Math.random() * scrambleColors.length)];

    async function runTextScramble(element) {
        const targetText = 'ROBOTIAX';
        const targetLetters = targetText.split('');
        element.innerHTML = '';
        let letterSpans = [];

        targetLetters.forEach(() => {
            const span = document.createElement('span');
            span.textContent = getRandomChar();
            span.style.color = getRandomColor();
            element.appendChild(span);
            letterSpans.push(span);
        });

        for (let i = 0; i < letterSpans.length; i++) {
            const currentSpan = letterSpans[i];
            const targetLetter = targetLetters[i];
            let scrambleCounter = 0;
            const scrambleInterval = setInterval(() => {
                currentSpan.textContent = getRandomChar();
                currentSpan.style.color = getRandomColor();
                scrambleCounter++;
                if (scrambleCounter > 5) { 
                    clearInterval(scrambleInterval);
                    currentSpan.textContent = targetLetter;
                    currentSpan.style.color = ''; 
                }
            }, 80); 
            await sleep(150); 
        }
        await sleep(200);
        element.classList.add('powered-up');
    }

    const titleElement = document.getElementById('brand-manifestation');
    if (titleElement) runTextScramble(titleElement);
});

// 3. CONTROLADOR DE TRANSICIONES
// Se mantiene fuera del DOMContentLoaded para ser accesible desde el atributo onclick del HTML
function runEffect(e, url, type) {
    e.preventDefault(); 

    if(type === 'matrix') {
        document.getElementById('fx-matrix').classList.add('active');
        setTimeout(() => { window.location.href = url; }, 800);
    }
    else if(type === 'warp') {
        document.getElementById('fx-warp').classList.add('active');
        setTimeout(() => { window.location.href = url; }, 500);
    }
    else if(type === 'tv') {
        document.getElementById('fx-tv').classList.add('active');
        setTimeout(() => { window.location.href = url; }, 600);
    }
    else if(type === 'gold') {
        document.getElementById('fx-gold').classList.add('active');
        setTimeout(() => { window.location.href = url; }, 900);
    }
}