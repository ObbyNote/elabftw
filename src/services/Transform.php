<?php declare(strict_types=1);
/**
 * @author Nicolas CARPi <nico-git@deltablot.email>
 * @copyright 2012 Nicolas CARPi
 * @see https://www.elabftw.net Official website
 * @license AGPL-3.0
 * @package elabftw
 */

namespace Elabftw\Services;

use Elabftw\Enums\Notifications;
use Elabftw\Exceptions\ImproperActionException;

use function sprintf;

/**
 * When values need to be transformed before display
 */
class Transform
{
    /**
     * Create a hidden input element for injecting CSRF token
     */
    public static function csrf(string $token): string
    {
        return sprintf("<input type='hidden' name='csrf' value='%s' />", $token);
    }

    // generate html for a notification to show on web interface
    public static function notif(array $notif): string
    {
        $relativeMoment = '<br><span class="relative-moment" title="%s"></span>';

        return match (Notifications::from($notif['category'])) {
            Notifications::CommentCreated =>
                sprintf(
                    '<span data-action="ack-notif" data-id="%d" data-href="experiments.php?mode=view&id=%d">%s</span>' . $relativeMoment,
                    (int) $notif['id'],
                    (int) $notif['body']['experiment_id'],
                    _('New comment on your experiment.'),
                    $notif['created_at'],
                ),
            Notifications::EventDeleted =>
                sprintf(
                    '<span data-action="ack-notif" data-id="%d" data-href="team.php?item=%d">%s (%s)</span>' . $relativeMoment,
                    (int) $notif['id'],
                    (int) $notif['body']['event']['item'],
                    _('A booked slot was deleted from the scheduler.'),
                    $notif['body']['actor'],
                    $notif['created_at'],
                ),
            Notifications::UserCreated =>
                sprintf(
                    '<span data-action="ack-notif" data-id="%d">%s</span>' . $relativeMoment,
                    (int) $notif['id'],
                    _('New user added to your team'),
                    $notif['created_at'],
                ),
            Notifications::UserNeedValidation =>
                sprintf(
                    '<span data-action="ack-notif" data-id="%d" data-href="admin.php">%s</span>' . $relativeMoment,
                    (int) $notif['id'],
                    _('A user needs account validation.'),
                    $notif['created_at'],
                ),
            Notifications::PdfGenericError =>
                sprintf(
                    '<span data-action="ack-notif" data-id="%d">%s</span>' . $relativeMoment,
                    (int) $notif['id'],
                    _('There was a problem during PDF creation.'),
                    $notif['created_at'],
                ),
            Notifications::MathjaxFailed =>
                sprintf(
                    '<span data-action="ack-notif" data-id="%d" data-href="%s.php?mode=view&id=%d">%s</span>' . $relativeMoment,
                    (int) $notif['id'],
                    $notif['body']['entity_page'],
                    (int) $notif['body']['entity_id'],
                    _('Tex rendering failed during PDF generation. The raw tex commands are retained but you might want to carefully check the generated PDF.'),
                    $notif['created_at'],
                ),
            Notifications::PdfAppendmentFailed =>
                sprintf(
                    '<span data-action="ack-notif" data-id="%d" data-href="%s.php?mode=view&id=%d">%s (%s)</span>' . $relativeMoment,
                    (int) $notif['id'],
                    $notif['body']['entity_page'],
                    (int) $notif['body']['entity_id'],
                    _('Some attached PDFs could not be appended.'),
                    $notif['body']['file_names'],
                    $notif['created_at'],
                ),
            Notifications::StepDeadline =>
                sprintf(
                    '<span data-action="ack-notif" data-id="%d" data-href="%s.php?mode=view&id=%d">%s</span>' . $relativeMoment,
                    (int) $notif['id'],
                    $notif['body']['entity_page'],
                    (int) $notif['body']['entity_id'],
                    _('A step deadline is approaching.'),
                    $notif['created_at'],
                ),
            default => throw new ImproperActionException('Invalid notification type.'),
        };
    }
}
