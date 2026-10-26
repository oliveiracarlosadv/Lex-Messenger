import Capacitor
import UIKit

/// Tela principal do Lex: a mesma do Capacitor, com os plugins próprios do app do iPhone.
class LexViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(LexWidgetPlugin())
    }
}
