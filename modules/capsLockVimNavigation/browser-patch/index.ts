define([], () => {
    'use strict'
    window.test = 5

    window.addEventListener(
        'keydown',
        e => {
            if (e.code !== 'CapsLock') return
            e.preventDefault()
            e.stopPropagation()
            window.dispatchEvent(
                new KeyboardEvent('keydown', {
                    code: 'ArrowDown',
                }),
            )
        },
        { capture: true },
    )
})
