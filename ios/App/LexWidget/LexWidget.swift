import SwiftUI
import WidgetKit

// Widget "Online agora" do Lex Messenger: mostra quais contatos estão online.
// O app grava a lista no grupo compartilhado; com o app fechado, fica a última lista.

private let appGroup = "group.br.com.lextecnologias.messenger"

struct Person: Codable, Identifiable {
    let id: String
    let name: String
    let status: String
    let color: String
    let photo: String?
}

struct Feed: Codable {
    let updatedAt: Double
    let people: [Person]
}

private func loadFeed() -> Feed {
    guard let text = UserDefaults(suiteName: appGroup)?.string(forKey: "online"),
          let data = text.data(using: .utf8),
          let feed = try? JSONDecoder().decode(Feed.self, from: data)
    else { return Feed(updatedAt: 0, people: []) }
    return feed
}

private let sample = Feed(updatedAt: Date().timeIntervalSince1970 * 1000, people: [
    Person(id: "1", name: "Ana Souza", status: "Online", color: "online", photo: nil),
    Person(id: "2", name: "Bruno Lima", status: "Ocupado", color: "busy", photo: nil),
    Person(id: "3", name: "Carla Dias", status: "Ausente", color: "away", photo: nil),
    Person(id: "4", name: "Diego Melo", status: "Online", color: "online", photo: nil),
])

struct Entry: TimelineEntry {
    let date: Date
    let feed: Feed
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: Date(), feed: sample) }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        let feed = loadFeed()
        completion(Entry(date: Date(), feed: context.isPreview && feed.people.isEmpty ? sample : feed))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        // Só muda quando o app avisa (WidgetCenter.reloadAllTimelines).
        completion(Timeline(entries: [Entry(date: Date(), feed: loadFeed())], policy: .never))
    }
}

// MARK: - Aparência

private extension Color {
    static let lexBlue = Color(red: 0.17, green: 0.42, blue: 0.77)
    static func status(_ c: String) -> Color {
        switch c {
        case "busy": return Color(red: 0.84, green: 0.27, blue: 0.27)
        case "away": return Color(red: 0.94, green: 0.63, blue: 0.13)
        default: return Color(red: 0.18, green: 0.74, blue: 0.36)
        }
    }
}

private let avatarColors: [Color] = [
    Color(red: 0.17, green: 0.42, blue: 0.77), Color(red: 0.18, green: 0.62, blue: 0.36),
    Color(red: 0.85, green: 0.51, blue: 0.17), Color(red: 0.56, green: 0.27, blue: 0.68),
    Color(red: 0.75, green: 0.22, blue: 0.17), Color(red: 0.09, green: 0.63, blue: 0.52),
]

struct Avatar: View {
    let person: Person
    let size: CGFloat

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Group {
                if let b64 = person.photo, let data = Data(base64Encoded: b64), let img = UIImage(data: data) {
                    Image(uiImage: img).resizable().scaledToFill()
                } else {
                    ZStack {
                        avatarColors[person.id.unicodeScalars.reduce(0) { ($0 &* 31 &+ Int($1.value)) & 0xFFFF } % avatarColors.count]
                        Text(String(person.name.first { $0.isLetter || $0.isNumber } ?? "?").uppercased())
                            .font(.system(size: size * 0.45, weight: .bold))
                            .foregroundColor(.white)
                    }
                }
            }
            .frame(width: size, height: size)
            .clipShape(Circle())
            Circle()
                .fill(Color.status(person.color))
                .frame(width: size * 0.3, height: size * 0.3)
                .overlay(Circle().stroke(Color(UIColor.systemBackground), lineWidth: 1.5))
        }
    }
}

struct Row: View {
    let person: Person

    var body: some View {
        Link(destination: URL(string: "lexmessenger://chat/\(person.id)")!) {
            HStack(spacing: 8) {
                Avatar(person: person, size: 30)
                VStack(alignment: .leading, spacing: 0) {
                    Text(person.name).font(.system(size: 13, weight: .semibold)).lineLimit(1)
                    Text(person.status).font(.system(size: 11)).foregroundColor(.secondary).lineLimit(1)
                }
                Spacer(minLength: 0)
            }
        }
    }
}

struct Header: View {
    let count: Int

    var body: some View {
        HStack(spacing: 6) {
            Circle().fill(Color.status("online")).frame(width: 8, height: 8)
            Text("Online agora").font(.system(size: 13, weight: .bold)).foregroundColor(.lexBlue)
            Spacer(minLength: 0)
            if count > 0 {
                Text("\(count)").font(.system(size: 12, weight: .bold)).foregroundColor(.white)
                    .padding(.horizontal, 7).padding(.vertical, 1)
                    .background(Capsule().fill(Color.status("online")))
            }
        }
    }
}

struct Updated: View {
    let at: Double

    var body: some View {
        if at > 0 {
            Text("Atualizado às " + Date(timeIntervalSince1970: at / 1000).formatted(date: .omitted, time: .shortened))
                .font(.system(size: 9)).foregroundColor(.secondary)
        }
    }
}

struct Empty: View {
    var body: some View {
        VStack(spacing: 4) {
            Spacer(minLength: 0)
            Text("Ninguém online agora").font(.system(size: 12, weight: .semibold))
            Text("Abra o Lex para atualizar").font(.system(size: 10)).foregroundColor(.secondary)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity)
    }
}

struct LexWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: Entry

    var body: some View {
        let people = entry.feed.people
        VStack(alignment: .leading, spacing: 6) {
            Header(count: people.count)
            if people.isEmpty {
                Empty()
            } else if family == .systemSmall {
                // Pequeno: até 4 fotos.
                let shown = Array(people.prefix(4))
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
                    ForEach(shown) { p in
                        VStack(spacing: 2) {
                            Avatar(person: p, size: 38)
                            Text(p.name.split(separator: " ").first.map(String.init) ?? p.name)
                                .font(.system(size: 10, weight: .medium)).lineLimit(1)
                        }
                    }
                }
                Spacer(minLength: 0)
            } else {
                let limit = family == .systemLarge ? 10 : 4
                let shown = Array(people.prefix(limit))
                if family == .systemMedium {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 8) {
                        ForEach(shown) { Row(person: $0) }
                    }
                } else {
                    ForEach(shown) { Row(person: $0) }
                }
                Spacer(minLength: 0)
            }
            HStack { Spacer(); Updated(at: entry.feed.updatedAt) }
        }
        .widgetURL(URL(string: "lexmessenger://abrir"))
        .containerBackground(for: .widget) {
            LinearGradient(colors: [Color(UIColor.systemBackground), Color.lexBlue.opacity(0.12)], startPoint: .top, endPoint: .bottom)
        }
    }
}

struct LexOnlineWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "LexOnline", provider: Provider()) { entry in
            LexWidgetView(entry: entry)
        }
        .configurationDisplayName("Online agora")
        .description("Mostra quais contatos estão online. Toque num contato para conversar.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

@main
struct LexWidgetBundle: WidgetBundle {
    var body: some Widget {
        LexOnlineWidget()
    }
}
