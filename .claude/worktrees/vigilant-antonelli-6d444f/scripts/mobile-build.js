const { execSync } = require('child_process');

console.log('Iniciando preparacion Android de Quioba...');
console.log('La APK cargara https://quioba.com dentro de Capacitor para evitar el bloqueo de static export con las rutas API.');

try {
    execSync('npx cap sync android', {
        stdio: 'inherit',
        env: process.env,
    });

    console.log('Proyecto Android sincronizado con exito.');
    console.log('Abre android/ en Android Studio y genera la APK desde Build > Build APK(s).');
} catch (error) {
    console.error('Error durante la preparacion Android:', error.message);
    process.exit(1);
}
