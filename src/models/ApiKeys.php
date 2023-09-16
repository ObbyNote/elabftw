<?php declare(strict_types=1);
/**
 * @author Nicolas CARPi <nico-git@deltablot.email>
 * @copyright 2012 Nicolas CARPi
 * @see https://www.elabftw.net Official website
 * @license AGPL-3.0
 * @package elabftw
 */

namespace Elabftw\Models;

use function bin2hex;
use Elabftw\Elabftw\Db;
use Elabftw\Enums\Action;
use Elabftw\Exceptions\ImproperActionException;
use Elabftw\Interfaces\RestInterface;
use Elabftw\Services\Filter;
use Elabftw\Traits\SetIdTrait;
use function password_hash;
use function password_verify;
use PDO;
use function random_bytes;

/**
 * Api keys CRUD class
 */
class ApiKeys implements RestInterface
{
    use SetIdTrait;

    private Db $Db;

    private string $key = '';

    public function __construct(private Users $Users, ?int $id = null)
    {
        $this->Db = Db::getConnection();
        $this->setId($id);
    }

    public function postAction(Action $action, array $reqBody): int
    {
        return $this->create($reqBody['name'] ?? 'RTFM', $reqBody['canwrite'] ?? 0);
    }

    public function patch(Action $action, array $params): array
    {
        throw new ImproperActionException('No patch action for apikeys.');
    }

    public function getPage(): string
    {
        return $this->key;
    }

    /**
     * Create a known key so we can test against it in dev mode
     * This function should only be called from the db:populate command
     */
    public function createKnown(string $apiKey): void
    {
        $hash = password_hash($apiKey, PASSWORD_BCRYPT);

        $sql = 'INSERT INTO api_keys (name, hash, can_write, userid, team) VALUES (:name, :hash, :can_write, :userid, :team)';
        $req = $this->Db->prepare($sql);
        $req->bindValue(':name', 'test key');
        $req->bindParam(':hash', $hash);
        $req->bindValue(':can_write', 1, PDO::PARAM_INT);
        $req->bindParam(':userid', $this->Users->userData['userid'], PDO::PARAM_INT);
        $req->bindParam(':team', $this->Users->userData['team'], PDO::PARAM_INT);
        $this->Db->execute($req);
    }

    /**
     * Read all keys for current user
     */
    public function readAll(): array
    {
        $sql = 'SELECT id, name, created_at, hash, can_write FROM api_keys WHERE userid = :userid AND team = :team';
        $req = $this->Db->prepare($sql);
        $req->bindParam(':userid', $this->Users->userData['userid'], PDO::PARAM_INT);
        $req->bindParam(':team', $this->Users->userData['team'], PDO::PARAM_INT);
        $this->Db->execute($req);

        return $req->fetchAll();
    }

    public function readOne(): array
    {
        return $this->readAll();
    }

    /**
     * Get a user from an API key
     */
    public function readFromApiKey(string $apiKey): array
    {
        $sql = 'SELECT hash, userid, can_write, team FROM api_keys';
        $req = $this->Db->prepare($sql);
        $this->Db->execute($req);
        foreach ($req->fetchAll() as $key) {
            if (password_verify($apiKey, $key['hash'])) {
                return array('userid' => $key['userid'], 'canWrite' => $key['can_write'], 'team' => $key['team']);
            }
        }
        throw new ImproperActionException('No corresponding API key found!');
    }

    public function destroy(): bool
    {
        $sql = 'DELETE FROM api_keys WHERE id = :id';
        $req = $this->Db->prepare($sql);
        $req->bindValue(':id', $this->id, PDO::PARAM_INT);

        return $this->Db->execute($req);
    }

    private function generateKey(): string
    {
        // keep it in the object so we can display it to the user after
        $this->key = bin2hex(random_bytes(42));
        return $this->key;
    }

    /**
     * Create a new key for current user
     */
    private function create(string $name, int $canwrite): int
    {
        $name = Filter::title($name);
        $hash = password_hash($this->generateKey(), PASSWORD_BCRYPT);

        $sql = 'INSERT INTO api_keys (name, hash, can_write, userid, team) VALUES (:name, :hash, :can_write, :userid, :team)';
        $req = $this->Db->prepare($sql);
        $req->bindParam(':name', $name);
        $req->bindParam(':hash', $hash);
        $req->bindParam(':can_write', $canwrite, PDO::PARAM_INT);
        $req->bindParam(':userid', $this->Users->userData['userid'], PDO::PARAM_INT);
        $req->bindParam(':team', $this->Users->userData['team'], PDO::PARAM_INT);
        $this->Db->execute($req);

        return $this->Db->lastInsertId();
    }
}
