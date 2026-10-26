import Capacitor
import Foundation
import WidgetKit

/// Grupo compartilhado entre o app e o widget "Online agora".
let lexAppGroup = "group.br.com.lextecnologias.messenger"

/// Recebe do app a lista de quem está online e pede ao iPhone para redesenhar o widget.
@objc(LexWidgetPlugin)
public class LexWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LexWidgetPlugin"
    public let jsName = "LexWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise)
    ]

    @objc func update(_ call: CAPPluginCall) {
        let data = call.getString("data") ?? "{}"
        UserDefaults(suiteName: lexAppGroup)?.set(data, forKey: "online")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}
