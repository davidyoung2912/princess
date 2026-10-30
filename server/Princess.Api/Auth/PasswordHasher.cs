using System.Security.Cryptography;

namespace Princess.Api.Auth;

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string stored);
}

/// <summary>PBKDF2-HMAC-SHA512, 16-byte salt, 64-byte hash. Stored as <c>pbkdf2$iterations$saltBase64$hashBase64</c> (D12), the format the persona seed writes.</summary>
public sealed class Pbkdf2PasswordHasher : IPasswordHasher
{
    public const int Iterations = 600_000;
    private const int SaltBytes = 16;
    private const int HashBytes = 64;

    public string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltBytes);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA512, HashBytes);
        return $"pbkdf2${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    public bool Verify(string password, string stored)
    {
        var parts = stored.Split('$');
        if (parts.Length != 4 || parts[0] != "pbkdf2" || !int.TryParse(parts[1], out var iterations) || iterations < 1) return false;
        byte[] salt, expected;
        try
        {
            salt = Convert.FromBase64String(parts[2]);
            expected = Convert.FromBase64String(parts[3]);
        }
        catch (FormatException)
        {
            return false;
        }
        if (expected.Length == 0) return false;
        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA512, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
}
