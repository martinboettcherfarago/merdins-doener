// Werkzeug „buslines". registerTool(kind, { down(input, t, e), move(input, t, e), up(input, t, e), hover(input, t), cancel(input), key(input, e) })
// t = Feld unter dem Zeiger {x, y, i, wx, wz}. input.g = Spiel, input.e = Engine, input.ui = Oberfläche.
import { registerTool } from '../registry.js';
void registerTool;
