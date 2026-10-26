import Capacitor
import Foundation
import UserNotifications
import WidgetKit

/// Grupo compartilhado entre o app e o widget "Online agora".
let lexAppGroup = "group.br.com.lextecnologias.messenger"

/// Recebe do app a lista de quem está online e pede ao iPhone para redesenhar o widget.
@objc(LexWidgetPlugin)
public class LexWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LexWidgetPlugin"
    public let jsName = "LexWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBadge", returnType: CAPPluginReturnPromise)
    ]

    @objc func update(_ call: CAPPluginCall) {
        let data = call.getString("data") ?? "{}"
        UserDefaults(suiteName: lexAppGroup)?.set(data, forKey: "online")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    /// Número de mensagens não lidas no ícone do app (a "bolinha vermelha").
    @objc func setBadge(_ call: CAPPluginCall) {
        let count = max(0, call.getInt("count") ?? 0)
        UNUserNotificationCenter.current().setBadgeCount(count) { _ in
            call.resolve()
        }
    }
}
