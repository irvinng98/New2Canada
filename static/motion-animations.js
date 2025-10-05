/**
 * Motion.dev Animation Integration for New2Canada
 * Add this script to your pages after the Motion CDN is loaded
 */

// Import motion functions
import { 
    animate, 
    stagger, 
    inView,
    scroll
} from "https://cdn.jsdelivr.net/npm/motion@11.11.13/+esm";

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    
    // ===================================
    // LANDING PAGE ANIMATIONS (index.html)
    // ===================================
    const landingContent = document.querySelector('.content');
    if (landingContent) {
        // Fade in main content
        animate(
            landingContent,
            { opacity: [0, 1], y: [30, 0] },
            { duration: 0.8, easing: [0.22, 1, 0.36, 1] }
        );

        // Animate title
        const title = document.querySelector('.main-title');
        if (title) {
            animate(
                title,
                { 
                    opacity: [0, 1], 
                    y: [20, 0],
                    scale: [0.95, 1]
                },
                { duration: 0.8, delay: 0.2, easing: [0.22, 1, 0.36, 1] }
            );
        }

        // Animate subtitle
        const subtitle = document.querySelector('.subtitle');
        if (subtitle) {
            animate(
                subtitle,
                { opacity: [0, 1], y: [15, 0] },
                { duration: 0.6, delay: 0.4, easing: [0.22, 1, 0.36, 1] }
            );
        }

        // Stagger animate buttons
        const buttons = document.querySelectorAll('.button-container .btn');
        if (buttons.length > 0) {
            animate(
                buttons,
                { opacity: [0, 1], y: [20, 0] },
                { 
                    duration: 0.5, 
                    delay: stagger(0.1, { start: 0.6 }),
                    easing: [0.22, 1, 0.36, 1]
                }
            );
        }
    }

    // ===================================
    // ONBOARDING FORM ANIMATIONS (user_data.html)
    // ===================================
    const onboardingContainer = document.querySelector('.onboarding-container');
    if (onboardingContainer) {
        // Fade in container
        animate(
            onboardingContainer,
            { opacity: [0, 1], y: [30, 0] },
            { duration: 0.8, easing: [0.22, 1, 0.36, 1] }
        );

        // Animate form elements with stagger
        const formElements = onboardingContainer.querySelectorAll('label, input, select, button');
        if (formElements.length > 0) {
            animate(
                formElements,
                { opacity: [0, 1], x: [-10, 0] },
                { 
                    duration: 0.4, 
                    delay: stagger(0.05, { start: 0.3 }),
                    easing: [0.22, 1, 0.36, 1]
                }
            );
        }

        // Add focus animations to inputs
        const inputs = onboardingContainer.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                animate(
                    input,
                    { scale: [1, 1.02] },
                    { duration: 0.2, easing: 'ease-out' }
                );
            });

            input.addEventListener('blur', () => {
                animate(
                    input,
                    { scale: [1.02, 1] },
                    { duration: 0.2, easing: 'ease-out' }
                );
            });
        });
    }

    // ===================================
    // ASSISTANCE PAGE ANIMATIONS (assistance.html)
    // ===================================
    const assistanceTitle = document.querySelector('.assistance-title');
    if (assistanceTitle) {
        // Animate title
        animate(
            assistanceTitle,
            { opacity: [0, 1], y: [20, 0] },
            { duration: 0.6, easing: [0.22, 1, 0.36, 1] }
        );
    }

    const assistanceSubtitle = document.querySelector('.assistance-subtitle');
    if (assistanceSubtitle) {
        animate(
            assistanceSubtitle,
            { opacity: [0, 1] },
            { duration: 0.5, delay: 0.2, easing: 'ease-out' }
        );
    }

    // Stagger animate category cards
    const categoryLinks = document.querySelectorAll('.category-link');
    if (categoryLinks.length > 0) {
        animate(
            categoryLinks,
            { 
                opacity: [0, 1], 
                y: [30, 0],
                scale: [0.9, 1]
            },
            { 
                duration: 0.5, 
                delay: stagger(0.08, { start: 0.4 }),
                easing: [0.22, 1, 0.36, 1]
            }
        );

        // Add hover scale animation to each card
        categoryLinks.forEach(card => {
            card.addEventListener('mouseenter', () => {
                animate(
                    card.querySelector('.category-icon'),
                    { scale: [1, 1.1], rotate: [0, 5] },
                    { duration: 0.3, easing: 'ease-out' }
                );
            });

            card.addEventListener('mouseleave', () => {
                animate(
                    card.querySelector('.category-icon'),
                    { scale: [1.1, 1], rotate: [5, 0] },
                    { duration: 0.3, easing: 'ease-out' }
                );
            });
        });
    }

    // ===================================
    // BUTTON HOVER ANIMATIONS (All pages)
    // ===================================
    const allButtons = document.querySelectorAll('.btn');
    allButtons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            animate(
                button,
                { scale: [1, 1.05] },
                { duration: 0.2, easing: 'ease-out' }
            );
        });

        button.addEventListener('mouseleave', () => {
            animate(
                button,
                { scale: [1.05, 1] },
                { duration: 0.2, easing: 'ease-out' }
            );
        });
    });

    // ===================================
    // SCROLL-TRIGGERED ANIMATIONS
    // ===================================
    // Fade in elements as they come into view
    const scrollElements = document.querySelectorAll('[data-animate-on-scroll]');
    scrollElements.forEach(element => {
        inView(element, () => {
            animate(
                element,
                { opacity: [0, 1], y: [30, 0] },
                { duration: 0.6, easing: [0.22, 1, 0.36, 1] }
            );
        });
    });
});