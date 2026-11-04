using System.Security.Cryptography.X509Certificates;
using System.Xml.Linq;
using Dapper;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.DataProtection.Repositories;
using Microsoft.Extensions.Options;
using Princess.Api.Data;

namespace Princess.Api.Services;

/// <summary>
/// The Data Protection key ring, which encrypts the health, calm, family and travellers documents (<c>StateRules.EncryptedKeys</c>).
/// Without a persisted ring every redeploy (or second instance) makes those documents unreadable. <c>DataProtection:Store</c> chooses where it lives:
/// <c>database</c> (default; <c>dbo.DataProtectionKeys</c>, shared by every instance) or <c>ephemeral</c> (the framework's default; tests only).
/// <c>DataProtection:CertificatePath</c> (and the secret <c>DataProtection:CertificatePassword</c>) encrypts the keys at rest in the table.
/// </summary>
public static class DataProtectionSetup
{
    public const string ApplicationName = "Princess.Api";

    public static IServiceCollection AddPrincessDataProtection(this IServiceCollection services, IConfiguration config, IHostEnvironment env)
    {
        var builder = services.AddDataProtection().SetApplicationName(ApplicationName);
        var store = config["DataProtection:Store"] ?? "database";
        if (store.Equals("ephemeral", StringComparison.OrdinalIgnoreCase)) return services;
        if (!store.Equals("database", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"DataProtection:Store '{store}' is not known. Use 'database' or 'ephemeral'.");

        services.AddSingleton<IConfigureOptions<KeyManagementOptions>>(sp =>
            new ConfigureOptions<KeyManagementOptions>(o => o.XmlRepository = new DatabaseXmlRepository(sp.GetRequiredService<IDbConnectionFactory>())));

        if (config["DataProtection:CertificatePath"] is { Length: > 0 } path)
            builder.ProtectKeysWithCertificate(X509CertificateLoader.LoadPkcs12FromFile(path, config["DataProtection:CertificatePassword"]));
        else if (!env.IsDevelopment() && !env.IsEnvironment("Testing"))
            Console.Error.WriteLine("WARNING: DataProtection:CertificatePath is not set, so the key ring is stored unencrypted in dbo.DataProtectionKeys.");
        return services;
    }
}

/// <summary>Keeps the key ring in <c>dbo.DataProtectionKeys</c>. The framework reads it at start-up and when a key rolls, so the calls are rare and may block.</summary>
public sealed class DatabaseXmlRepository(IDbConnectionFactory db) : IXmlRepository
{
    public IReadOnlyCollection<XElement> GetAllElements()
    {
        using var c = db.OpenAsync().GetAwaiter().GetResult();
        return [.. c.Query<string>("SELECT Xml FROM dbo.DataProtectionKeys ORDER BY Id").Select(x => XElement.Parse(x))];
    }

    public void StoreElement(XElement element, string friendlyName)
    {
        using var c = db.OpenAsync().GetAwaiter().GetResult();
        c.Execute("INSERT INTO dbo.DataProtectionKeys (FriendlyName, Xml) VALUES (@friendlyName, @xml)", new { friendlyName, xml = element.ToString(SaveOptions.DisableFormatting) });
    }
}
