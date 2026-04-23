// ===================== MOBILE NAV =====================
const hamburger = document.getElementById('hamburger');
const navLinks = document.querySelector('.nav-links');
const navActions = document.querySelector('.nav-actions');

if (hamburger) {
    hamburger.addEventListener('click', () => {
        navLinks?.classList.toggle('active');
        navActions?.classList.toggle('active');
        hamburger.classList.toggle('active');
    });

    // Close mobile menu when clicking on nav links
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks?.classList.remove('active');
            navActions?.classList.remove('active');
            hamburger.classList.remove('active');
        });
    });
}

// ===================== SMOOTH SCROLLING =====================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// ===================== HEADER SCROLL EFFECT =====================
window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (!header) return;
    if (window.scrollY > 60) {
        header.style.boxShadow = '0 4px 24px rgba(0,0,0,0.12)';
    } else {
        header.style.boxShadow = '0 2px 16px rgba(0,0,0,0.07)';
    }
});

// ===================== UPLOAD / DROP ZONE =====================
const uploadInput = document.getElementById('photoUpload');
const uploadBtn = document.getElementById('uploadBtn');
const heroSection = document.querySelector('.hero');

// Trigger file picker when label clicked (it's a <label for="..."> so this is automatic)
// Show file name after selection
if (uploadInput) {
    uploadInput.addEventListener('change', () => {
        const file = uploadInput.files[0];
        if (file) {
            showToast(`📸 "${file.name}" selected! Processing…`);
        }
    });
}

// Drag-and-drop on the hero section
if (heroSection) {
    heroSection.addEventListener('dragover', (e) => {
        e.preventDefault();
        heroSection.classList.add('drag-over');
    });

    heroSection.addEventListener('dragleave', () => {
        heroSection.classList.remove('drag-over');
    });

    heroSection.addEventListener('drop', (e) => {
        e.preventDefault();
        heroSection.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            showToast(`📸 "${file.name}" dropped! Processing…`);
        } else {
            showToast('⚠️ Please drop a valid image file.');
        }
    });
}

// ===================== TOAST NOTIFICATION =====================
function showToast(message) {
    let toast = document.getElementById('ai-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'ai-toast';
        toast.style.cssText = `
            position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%) translateY(80px);
            background: #1a1a2e; color: #fff; padding: 14px 28px;
            border-radius: 50px; font-family: 'Poppins', sans-serif; font-size: 0.92rem;
            font-weight: 500; z-index: 9999; box-shadow: 0 8px 28px rgba(0,0,0,0.25);
            opacity: 0; transition: opacity 0.35s ease, transform 0.35s ease;
            white-space: nowrap;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    // Show
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    // Hide after 3s
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(80px)';
    }, 3000);
}

// ===================== SCROLL REVEAL =====================
const observerOptions = {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.addEventListener('DOMContentLoaded', () => {
    const animateElements = document.querySelectorAll(
        '.problem-card, .feature-card, .tech-category, .section-header'
    );
    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(32px)';
        el.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
        observer.observe(el);
    });
});

// ===================== UTILITIES =====================
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}