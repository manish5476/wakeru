const fs = require('fs');

function updateFile(filePath, replacer) {
    let content = fs.readFileSync(filePath, 'utf8');
    const crlf = content.includes('\r\n');
    const normalized = content.replace(/\r\n/g, '\n');
    const updated = replacer(normalized);
    if (updated !== normalized) {
        fs.writeFileSync(filePath, crlf ? updated.replace(/\n/g, '\r\n') : updated, 'utf8');
        console.log('Updated:', filePath);
    } else {
        console.log('No change needed or pattern not matched in:', filePath);
    }
}

// 1. register.tsx
updateFile('d:/Split/New/TripSplit/src/app/(auth)/register.tsx', (content) => {
    // Replace Alert.alert block or router.replace in handleRegister
    const regex = /await registerWithEmail\(trimmedEmail, password, trimmedName, ''\);[\s\S]*?finally \{/m;
    const replacement = `await registerWithEmail(trimmedEmail, password, trimmedName, '');
            showToast.success(
                'Account Created!',
                'A verification link has been sent to your email.'
            );
            router.replace({
                pathname: '/(auth)/verify-email',
                params: { email: trimmedEmail }
            });
        } catch (err: any) {
            showToast.error('Registration Notice', err.message || 'Registration could not be completed.');
        } finally {`;
    return content.replace(regex, replacement);
});

// 2. login.tsx
updateFile('d:/Split/New/TripSplit/src/app/(auth)/login.tsx', (content) => {
    const regex = /if \(e\?\.code === 'EMAIL_NOT_VERIFIED' \|\| e\?\.message\?\.toLowerCase\(\)\.includes\('verify your email'\)\) \{[\s\S]*?showToast\.fromError\(e, 'Login Failed'\);\s*\}/m;
    const replacement = `if (e?.code === 'EMAIL_NOT_VERIFIED' || e?.message?.toLowerCase().includes('verify your email')) {
                router.push({
                    pathname: '/(auth)/verify-email',
                    params: { email: email.trim() }
                });
            } else {
                showToast.fromError(e, 'Login Failed');
            }`;
    return content.replace(regex, replacement);
});
