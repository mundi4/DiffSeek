let closeDrawer;

function initializeDrawer() {
    const drawer = document.getElementById("drawer");
    let isOpen = drawer.classList.contains("open");
    
    function open() {
        drawer.classList.add("open");
        isOpen = true;
    }
    
    function close() {
        drawer.classList.remove("open");
        isOpen = false;
    }
    
    function toggle() {
        drawer.classList.toggle("open");
        isOpen = !isOpen;
    }
    
    document.addEventListener('click', function (event) {
        if (isOpen) {
            // close();
        }
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            close();
        }
        if (event.key === 'F2') {
            toggle();
        }
    });

    closeDrawer = close;

    return {
        el:drawer,
        open: open,
        close: close,
        toggle: toggle,
    }
}