import './style.css';
import { initGameHost } from './shell/gameHost';
import { go, registerScreen } from './shell/nav';
import { gamesScreen } from './shell/screens/games';
import { homeScreen } from './shell/screens/home';
import { lockerScreen } from './shell/screens/locker';
import { playersScreen } from './shell/screens/players';
import { podiumScreen } from './shell/screens/podium';
import { roundScreen } from './shell/screens/round';
import { settingsScreen } from './shell/screens/settings';

registerScreen('home', homeScreen);
registerScreen('players', playersScreen);
registerScreen('games', gamesScreen);
registerScreen('round', roundScreen);
registerScreen('podium', podiumScreen);
registerScreen('locker', lockerScreen);
registerScreen('settings', settingsScreen);

// Block pinch-zoom / double-tap zoom on iOS, which would break multi-touch games.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

initGameHost();
go('home');
