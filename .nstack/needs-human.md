# Needs human
- [ ] 2026-11-27 Give the agent's user access to /dev/kvm so the Android emulator (AVD nstack35) can run: `sudo usermod -aG kvm tokyovo_assistant` (then a new login session), or `sudo setfacl -m u:tokyovo_assistant:rw /dev/kvm`. nstack may not change machine permissions itself (the attempt was refused). Until then Android flows are unverified. Check: `test -w /dev/kvm && echo ok`
