<?php declare(strict_types=1);
/**
 * @author Nicolas CARPi <nico-git@deltablot.email>
 * @copyright 2012 Nicolas CARPi
 * @see https://www.elabftw.net Official website
 * @license AGPL-3.0
 * @package elabftw
 */

namespace Elabftw\Models;

/**
 * An anonymous user is "logged in" in a team and has default settings
 * With a userid of 0
 */
final class AnonymousUser extends Users
{
    public function __construct(public int $team, private string $lang)
    {
        parent::__construct(null, $team);
        $this->fillUserData();
    }

    private function fillUserData(): void
    {
        $this->userData['team'] = $this->team;
        $this->userData['limit_nb'] = 15;
        $this->userData['display_mode'] = 'it';
        $this->userData['orderby'] = 'date';
        $this->userData['sort'] = 'desc';
        $this->userData['disable_shortcuts'] = 1;
        $this->userData['scope'] = 2;
        $this->userData['fullname'] = 'Anon Ymous';
        $this->userData['is_sysadmin'] = 0;
        $this->userData['lang'] = $this->lang;
        $this->userData['use_isodate'] = '0';
        $this->userData['uploads_layout'] = '1';
        $this->userData['inc_files_pdf'] = '1';
        $this->userData['pdf_format'] = 'A4';
        $this->userData['userid'] = 0;
        $this->userData['entrypoint'] = 1;
    }
}
